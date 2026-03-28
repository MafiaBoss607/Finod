/**
 * Export the Finod canvas graph as a JSONL file for LLM training.
 * Walks the node/edge graph preserving folder hierarchy and order.
 */

import type { Node, Edge } from '@xyflow/react';
import { extractText } from './textExtractor';
import { generateQAPairs, type QAPair } from './qaGenerator';

/** Shape of each JSONL entry */
export type JsonlEntry = {
  path: string;
  filename: string;
  extension: string;
  content: string;
  metadata: {
    size: string;
    order: number;
    node_type: string;
    comments: string[];
    url?: string;
    page_number?: number;
    parent_file?: string;
  };
};

/**
 * Build an adjacency list from edges (source → targets).
 */
function buildAdjacency(edges: Edge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const children = adj.get(e.source) || [];
    children.push(e.target);
    adj.set(e.source, children);
  }
  return adj;
}

/**
 * Find root nodes — nodes that have no incoming edges,
 * OR top-level folder nodes (no parentFolder in data).
 */
function findRootNodes(nodes: Node[], edges: Edge[]): Node[] {
  const hasIncoming = new Set(edges.map((e) => e.target));
  return nodes.filter((n) => !hasIncoming.has(n.id));
}

/**
 * Collect comments connected to a given node.
 */
function getConnectedComments(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): string[] {
  const comments: string[] = [];
  for (const e of edges) {
    let commentNodeId: string | null = null;
    if (e.source === nodeId) commentNodeId = e.target;
    else if (e.target === nodeId) commentNodeId = e.source;
    if (!commentNodeId) continue;

    const commentNode = nodes.find((n) => n.id === commentNodeId && n.type === 'comment');
    if (commentNode && commentNode.data.comment) {
      comments.push(String(commentNode.data.comment));
    }
  }
  return comments;
}

/**
 * Recursively walk the graph in DFS order, collecting JSONL entries.
 * For unexpanded folders, walk their stored children metadata.
 */
async function walkGraph(
  nodeId: string,
  currentPath: string,
  nodes: Node[],
  edges: Edge[],
  adj: Map<string, string[]>,
  fileBlobsMap: Map<string, File>,
  entries: JsonlEntry[],
  visited: Set<string>,
  onProgress: (msg: string) => void,
): Promise<void> {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const label = String(node.data.label || '');
  const nodeType = node.type || 'file';

  if (nodeType === 'comment') {
    // Comments are collected as metadata on connected nodes, skip standalone processing
    return;
  }

  if (nodeType === 'folder') {
    const folderPath = currentPath ? `${currentPath}/${label}` : label;

    // If folder is expanded — follow child edges on the canvas
    if (node.data.expanded && node.data.childIds) {
      const childIds = node.data.childIds as string[];
      for (const childId of childIds) {
        await walkGraph(childId, folderPath, nodes, edges, adj, fileBlobsMap, entries, visited, onProgress);
      }
    } else {
      // Unexpanded folder — walk stored children metadata recursively
      const children = (node.data.children as any[]) || [];
      await walkStoredChildren(children, folderPath, nodes, edges, fileBlobsMap, entries, onProgress);
    }
    return;
  }

  // File / URL / Page nodes — extract content
  const ext = String(node.data.extension || '').toLowerCase();
  const fileName = ext ? `${label}.${ext}` : label;
  const path = currentPath || '';

  onProgress(`Extracting: ${path ? path + '/' : ''}${fileName}`);

  let content = '';

  // Try to find file blob
  let fileBlob = fileBlobsMap.get(nodeId);
  if (!fileBlob && node.data._fileKey) {
    fileBlob = fileBlobsMap.get(String(node.data._fileKey));
  }
  if (!fileBlob) {
    const key = ext ? `${label}.${ext}` : label;
    fileBlob = fileBlobsMap.get(key);
  }

  if (nodeType === 'url') {
    content = String(node.data.url || '');
  } else if (fileBlob) {
    content = await extractText(fileBlob, ext);
  } else {
    content = '[No file data available — file was not imported in this session]';
  }

  const comments = getConnectedComments(nodeId, nodes, edges);

  entries.push({
    path,
    filename: fileName,
    extension: ext,
    content,
    metadata: {
      size: String(node.data.size || ''),
      order: entries.length,
      node_type: nodeType,
      comments,
      ...(nodeType === 'url' ? { url: String(node.data.url || '') } : {}),
      ...(node.data.pageNumber != null ? { page_number: Number(node.data.pageNumber) } : {}),
      ...(node.data.parentFile ? { parent_file: String(node.data.parentFile) } : {}),
    },
  });

  // Also walk outgoing connections (non-parent edges)
  const outgoing = adj.get(nodeId) || [];
  for (const childId of outgoing) {
    if (!visited.has(childId)) {
      await walkGraph(childId, currentPath, nodes, edges, adj, fileBlobsMap, entries, visited, onProgress);
    }
  }
}

/**
 * Walk stored children metadata (from unexpanded folders).
 * These don't have canvas nodes, so we extract from the blob map using _fileKey.
 */
async function walkStoredChildren(
  children: any[],
  parentPath: string,
  nodes: Node[],
  edges: Edge[],
  fileBlobsMap: Map<string, File>,
  entries: JsonlEntry[],
  onProgress: (msg: string) => void,
): Promise<void> {
  for (const child of children) {
    const name = String(child.name || child.label || '');
    const ext = String(child.extension || '').toLowerCase();
    const childType = child.type || 'file';

    if (childType === 'folder') {
      const folderPath = `${parentPath}/${name}`;
      const subChildren = child.subChildren || [];
      await walkStoredChildren(subChildren, folderPath, nodes, edges, fileBlobsMap, entries, onProgress);
      continue;
    }

    const fileName = ext ? `${name}.${ext}` : name;
    onProgress(`Extracting: ${parentPath}/${fileName}`);

    let content = '';
    // Look up blob by _fileKey or by name.extension
    let fileBlob = child._fileKey ? fileBlobsMap.get(child._fileKey) : undefined;
    if (!fileBlob) {
      const key = ext ? `${name}.${ext}` : name;
      fileBlob = fileBlobsMap.get(key);
    }

    if (childType === 'url') {
      content = String(child.url || '');
    } else if (fileBlob) {
      content = await extractText(fileBlob, ext);
    } else {
      content = '[No file data available — file was not imported in this session]';
    }

    entries.push({
      path: parentPath,
      filename: fileName,
      extension: ext,
      content,
      metadata: {
        size: String(child.size || ''),
        order: entries.length,
        node_type: childType,
        comments: [],
        ...(childType === 'url' ? { url: String(child.url || '') } : {}),
        ...(child.pageNumber != null ? { page_number: Number(child.pageNumber) } : {}),
        ...(child.parentFile ? { parent_file: String(child.parentFile) } : {}),
      },
    });
  }
}

/**
 * Export the entire canvas graph to a JSONL string.
 * Each line is a JSON object representing one document/file.
 */
export async function exportToJsonl(
  nodes: Node[],
  edges: Edge[],
  fileBlobsMap: Map<string, File>,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const progress = onProgress || (() => {});
  const adj = buildAdjacency(edges);
  const roots = findRootNodes(nodes, edges);
  const entries: JsonlEntry[] = [];
  const visited = new Set<string>();

  progress('Finding root nodes...');

  // Sort roots by x position (left to right), then y position (top to bottom)
  roots.sort((a, b) => {
    if (Math.abs(a.position.x - b.position.x) > 50) return a.position.x - b.position.x;
    return a.position.y - b.position.y;
  });

  for (const root of roots) {
    await walkGraph(root.id, '', nodes, edges, adj, fileBlobsMap, entries, visited, progress);
  }

  progress(`Done! Generated ${entries.length} entries.`);

  // Convert to JSONL (one JSON object per line)
  return entries.map((entry) => JSON.stringify(entry)).join('\n');
}

/**
 * Trigger download of a JSONL string as a file.
 */
export function downloadJsonl(jsonlString: string, filename = 'finod-export.jsonl') {
  const blob = new Blob([jsonlString], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Export the canvas graph as Q&A pairs in Alpaca JSONL format.
 * 1. Extracts text from all files (same as exportToJsonl)
 * 2. Sends each document's text through Ollama to generate Q&A pairs
 * 3. Returns JSONL with instruction/input/output format
 */
export async function exportToQAJsonl(
  nodes: Node[],
  edges: Edge[],
  fileBlobsMap: Map<string, File>,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const progress = onProgress || (() => {});

  // Step 1: Collect all documents with their text (reuse existing logic)
  progress('📄 Step 1: Extracting text from all files...');
  const rawJsonl = await exportToJsonl(nodes, edges, fileBlobsMap, progress);
  if (!rawJsonl.trim()) return '';

  const entries: JsonlEntry[] = rawJsonl.split('\n').filter(Boolean).map((line) => JSON.parse(line));

  // Step 2: Generate Q&A pairs for each document via Ollama
  progress('🧠 Step 2: Generating Q&A pairs via Ollama (llama3.1:8b)...');
  const allQAPairs: QAPair[] = [];
  let fileIndex = 0;

  for (const entry of entries) {
    fileIndex++;
    const sourceLabel = `${entry.path ? entry.path + '/' : ''}${entry.filename}`;
    progress(`🧠 [${fileIndex}/${entries.length}] Processing: ${sourceLabel}`);

    const pairs = await generateQAPairs(entry.content, sourceLabel, progress);
    allQAPairs.push(...pairs);
  }

  progress(`✅ Done! Generated ${allQAPairs.length} Q&A pairs from ${entries.length} files.`);

  // Step 3: Convert to JSONL
  return allQAPairs.map((pair) => JSON.stringify(pair)).join('\n');
}
