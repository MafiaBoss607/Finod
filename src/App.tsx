import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { NodeTypes, Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './index.css';

import { FileNode } from './components/nodes/FileNode';
import { FolderNode } from './components/nodes/FolderNode';
import { UrlNode } from './components/nodes/UrlNode';
import { PageNode } from './components/nodes/PageNode';
import { CommentNode } from './components/nodes/CommentNode';
import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ContextMenu } from './components/ContextMenu';
import { formatFileSize, getFileExtension, getBaseName } from './utils/fileHelpers';
import { exportToQAJsonl, downloadJsonl } from './utils/jsonlExporter';
import { checkOllamaStatus } from './utils/qaGenerator';

const nodeTypes: NodeTypes = {
  file: FileNode,
  folder: FolderNode,
  url: UrlNode,
  page: PageNode,
  comment: CommentNode,
};

let id = 0;
const getId = () => `node_${Date.now()}_${id++}`;

// ── helpers ──────────────────────────────────────────────
function layoutNewNodes(startX: number, startY: number, count: number, cols = 4) {
  const gapX = 200;
  const gapY = 80;
  return Array.from({ length: count }, (_, i) => ({
    x: startX + (i % cols) * gapX,
    y: startY + Math.floor(i / cols) * gapY,
  }));
}

function bottomY(nodes: Node[]): number {
  if (nodes.length === 0) return 80;
  return Math.max(...nodes.map((n) => n.position.y)) + 100;
}

// ── folder tree builder ──────────────────────────────────
type TreeNode = {
  name: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: string;
  children?: TreeNode[];
  file?: File;
};

function buildFolderTree(files: FileList): TreeNode[] {
  const root: TreeNode = { name: 'root', type: 'folder', children: [] };

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const relativePath = (f as any).webkitRelativePath as string;
    const parts = relativePath ? relativePath.split('/') : [f.name];

    let current = root;
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      const isFile = j === parts.length - 1;

      if (isFile) {
        current.children!.push({
          name: getBaseName(part),
          type: 'file',
          extension: getFileExtension(part),
          size: formatFileSize(f.size),
          file: f,
        });
      } else {
        let existing = current.children!.find(
          (c) => c.type === 'folder' && c.name === part,
        );
        if (!existing) {
          existing = { name: part, type: 'folder', children: [] };
          current.children!.push(existing);
        }
        current = existing;
      }
    }
  }

  return root.children || [];
}

/** Convert a TreeNode[] into the flat children metadata format used in folder data */
function treeToChildrenMeta(treeNodes: TreeNode[]): any[] {
  return treeNodes.map((tn) => {
    if (tn.type === 'folder') {
      return {
        name: tn.name,
        label: tn.name,
        type: 'folder',
        extension: '',
        size: '',
        itemCount: (tn.children || []).length,
        subChildren: treeToChildrenMeta(tn.children || []),
      };
    }
    // Store file blob in the map using the original filename as a stable key
    const fileKey = `${tn.name}.${(tn.extension || '').toLowerCase()}`;
    if (tn.file) {
      fileBlobsMap.set(fileKey, tn.file);
    }
    return {
      name: tn.name,
      label: tn.name,
      type: 'file',
      extension: tn.extension || '',
      size: tn.size || '',
      _fileKey: fileKey,
    };
  });
}

// ── rerouted edge bookkeeping ────────────────────────────
type ReroutedEdge = {
  reroutedEdgeId: string;
  originalChildId: string;
  externalNodeId: string;
  direction: 'incoming' | 'outgoing';
};

const reroutedEdgesMap = new Map<string, ReroutedEdge[]>();

// ── file blob storage (node-id → File) ──────────────────
const fileBlobsMap = new Map<string, File>();

// ── Set to skip nodes that were JUST created (prevent instant absorption) ──
const recentlyCreatedNodeIds = new Set<string>();

// ── main component ──────────────────────────────────────
function Flow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition, setViewport, getViewport } = useReactFlow();
  const nodesRef = useRef<Node[]>(nodes);
  nodesRef.current = nodes; // always up to date

  const edgeReconnectSuccessful = useRef(true);

  // ── export state ────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  // ── persistence ────────────────────────────────────────
  const onSave = useCallback(() => {
    const flow = { nodes, edges, viewport: getViewport() };
    localStorage.setItem('finod-graph', JSON.stringify(flow));
    alert('Graph saved successfully!');
  }, [nodes, edges, getViewport]);

  const onLoad = useCallback(() => {
    const flowJSON = localStorage.getItem('finod-graph');
    if (flowJSON) {
      const flow = JSON.parse(flowJSON);
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setViewport(flow.viewport || { x: 0, y: 0, zoom: 1 });
    } else {
      alert('No saved graph found.');
    }
  }, [setNodes, setEdges, setViewport]);

  // ── edge connection ────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges((eds) =>
        addEdge(
          { ...params, animated: true, style: { stroke: 'var(--accent-primary)', strokeWidth: 2 } } as Edge,
          eds,
        ),
      ),
    [setEdges],
  );

  // ── double-click = expand / collapse folder ────────────
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'folder') return;

      const isExpanded = !!node.data.expanded;

      if (!isExpanded) {
        /* ═══════════ EXPAND ═══════════ */
        const children = (node.data.children as any[]) || [];
        if (children.length === 0) return;

        // Compute dynamic startY to avoid overlapping other expanded children
        const childX = node.position.x + 220;
        const currentNodes = nodesRef.current;
        const existingAtX = currentNodes.filter(
          (n) => n.id !== node.id && Math.abs(n.position.x - childX) < 100,
        );
        const maxExistingY =
          existingAtX.length > 0
            ? Math.max(
                ...existingAtX.map(
                  (n) => n.position.y + (n.measured?.height ?? 50),
                ),
              )
            : -Infinity;
        const startY = Math.max(node.position.y, maxExistingY + 20);

        const childIds: string[] = [];
        const childNodes: Node[] = [];

        children.forEach((child: any, i: number) => {
          const childId = `${node.id}_child_${i}`;
          childIds.push(childId);

          const isChildFolder = child.type === 'folder';

          // Map child node ID to its file blob if available
          if (!isChildFolder && child._fileKey) {
            const blob = fileBlobsMap.get(child._fileKey);
            if (blob) fileBlobsMap.set(childId, blob);
          } else if (!isChildFolder) {
            // Fallback: try to look up by name.extension
            const ext = String(child.extension || '').toLowerCase();
            const name = String(child.name || child.label || '');
            const key = ext ? `${name}.${ext}` : name;
            const blob = fileBlobsMap.get(key);
            if (blob) fileBlobsMap.set(childId, blob);
          }

          childNodes.push({
            id: childId,
            type: isChildFolder ? 'folder' : (child.type || 'file'),
            position: { x: childX, y: startY + i * 60 },
            data: {
              label: child.name || child.label,
              extension: child.extension,
              size: child.size,
              url: child.url,
              pageNumber: child.pageNumber,
              parentFile: child.parentFile,
              parentFolder: node.id,
              _fileKey: child._fileKey,
              ...(isChildFolder
                ? {
                    itemCount: child.itemCount || (child.subChildren || []).length,
                    expanded: false,
                    children: child.subChildren || [],
                    childIds: [],
                    externalConnections: 0,
                  }
                : {}),
            },
          });

          // Mark as recently created so onNodeDragStop won't absorb them
          recentlyCreatedNodeIds.add(childId);
          setTimeout(() => recentlyCreatedNodeIds.delete(childId), 500);
        });

        // Create folder → child edges
        const childEdges: Edge[] = childIds.map((cid) => ({
          id: `edge_${node.id}_${cid}`,
          source: node.id,
          target: cid,
          animated: true,
          style: { stroke: 'var(--color-folder)', strokeWidth: 1.5, strokeDasharray: '4 2' },
        }));

        // Restore rerouted edges
        const rerouted = reroutedEdgesMap.get(node.id) || [];
        const restoredEdges: Edge[] = [];
        const reroutedIdsToRemove = new Set<string>();

        for (const r of rerouted) {
          reroutedIdsToRemove.add(r.reroutedEdgeId);
          const restoredId = `restored_${r.originalChildId}_${r.externalNodeId}`;
          restoredEdges.push(
            r.direction === 'outgoing'
              ? { id: restoredId, source: r.originalChildId, target: r.externalNodeId, animated: true, style: { stroke: 'var(--accent-primary)', strokeWidth: 2 } }
              : { id: restoredId, source: r.externalNodeId, target: r.originalChildId, animated: true, style: { stroke: 'var(--accent-primary)', strokeWidth: 2 } },
          );
        }
        reroutedEdgesMap.delete(node.id);

        setNodes((nds) =>
          nds
            .map((n) =>
              n.id === node.id
                ? { ...n, data: { ...n.data, expanded: true, childIds, externalConnections: 0 } }
                : n,
            )
            .concat(childNodes),
        );
        setEdges((eds) =>
          eds.filter((e) => !reroutedIdsToRemove.has(e.id)).concat(childEdges).concat(restoredEdges),
        );
      } else {
        /* ═══════════ COLLAPSE (recursive) ═══════════ */
        const currentNodes = nodesRef.current;

        // Snapshot: rebuild children metadata from live canvas state
        const snapshotChildrenMeta = (folderId: string, nds: Node[]): any[] => {
          const folder = nds.find((n) => n.id === folderId);
          if (!folder) return [];
          const cids = (folder.data.childIds as string[]) || [];
          return cids.map((cid) => {
            const child = nds.find((n) => n.id === cid);
            if (!child) return null;
            if (child.type === 'folder') {
              const subChildren = child.data.expanded
                ? snapshotChildrenMeta(cid, nds)
                : (child.data.children as any[]) || [];
              return {
                name: String(child.data.label || ''),
                label: String(child.data.label || ''),
                type: 'folder',
                extension: '',
                size: '',
                itemCount: subChildren.length,
                subChildren,
              };
            }
            return {
              name: String(child.data.label || ''),
              label: String(child.data.label || ''),
              type: child.type || 'file',
              extension: child.data.extension ? String(child.data.extension) : '',
              size: child.data.size ? String(child.data.size) : '',
              url: child.data.url ? String(child.data.url) : '',
              pageNumber: child.data.pageNumber,
              parentFile: child.data.parentFile,
              comment: child.data.comment ? String(child.data.comment) : '',
              _fileKey: child.data._fileKey ? String(child.data._fileKey) : '',
            };
          }).filter(Boolean);
        };

        const updatedChildren = snapshotChildrenMeta(node.id, currentNodes);

        // Collect ALL descendant IDs (children, grandchildren, etc.)
        const allDescendants = new Set<string>();
        const collectDescendants = (parentId: string, nds: Node[]) => {
          const parent = nds.find((n) => n.id === parentId);
          if (!parent) return;
          const cids = (parent.data.childIds as string[]) || [];
          for (const cid of cids) {
            allDescendants.add(cid);
            const childNode = nds.find((n) => n.id === cid);
            if (childNode?.type === 'folder' && childNode.data.expanded) {
              collectDescendants(cid, nds);
              reroutedEdgesMap.delete(cid);
            }
          }
        };
        collectDescendants(node.id, currentNodes);

        setEdges((currentEdges) => {
          const toRemove = new Set<string>();
          const externals: { edge: Edge; childId: string; direction: 'incoming' | 'outgoing' }[] = [];

          for (const e of currentEdges) {
            const srcDesc = allDescendants.has(e.source);
            const tgtDesc = allDescendants.has(e.target);

            if ((srcDesc && tgtDesc) || (srcDesc && e.target === node.id) || (tgtDesc && e.source === node.id)) {
              toRemove.add(e.id);
            } else if (srcDesc && !tgtDesc) {
              externals.push({ edge: e, childId: e.source, direction: 'outgoing' });
              toRemove.add(e.id);
            } else if (tgtDesc && !srcDesc) {
              externals.push({ edge: e, childId: e.target, direction: 'incoming' });
              toRemove.add(e.id);
            }
          }

          const reroutedInfo: ReroutedEdge[] = [];
          const proxyEdges: Edge[] = [];

          for (const ext of externals) {
            const proxyId = `proxy_${node.id}_${ext.edge.id}`;
            const proxy: Edge = ext.direction === 'outgoing'
              ? { id: proxyId, source: node.id, target: ext.edge.target, animated: true, style: { stroke: 'var(--accent-primary)', strokeWidth: 2, strokeDasharray: '6 3' } }
              : { id: proxyId, source: ext.edge.source, target: node.id, animated: true, style: { stroke: 'var(--accent-primary)', strokeWidth: 2, strokeDasharray: '6 3' } };
            proxyEdges.push(proxy);
            reroutedInfo.push({
              reroutedEdgeId: proxyId,
              originalChildId: ext.childId,
              externalNodeId: ext.direction === 'outgoing' ? ext.edge.target : ext.edge.source,
              direction: ext.direction,
            });
          }

          reroutedEdgesMap.set(node.id, reroutedInfo);

          setNodes((nds) =>
            nds.filter((n) => !allDescendants.has(n.id)).map((n) =>
              n.id === node.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      expanded: false,
                      childIds: [],
                      children: updatedChildren,
                      itemCount: updatedChildren.length,
                      externalConnections: externals.length,
                    },
                  }
                : n,
            ),
          );

          return currentEdges.filter((e) => !toRemove.has(e.id)).concat(proxyEdges);
        });
      }
    },
    [setNodes, setEdges],
  );

  // ── drop node onto folder (onNodeDragStop) ─────────────
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      // Skip if this node was JUST created (prevents sidebar-drop from being absorbed)
      if (recentlyCreatedNodeIds.has(draggedNode.id)) return;

      // Use the ref to get the LATEST node positions
      const currentNodes = nodesRef.current;
      const NODE_W = 180;
      const NODE_H = 50;

      const dragRect = {
        x: draggedNode.position.x,
        y: draggedNode.position.y,
        w: draggedNode.measured?.width ?? NODE_W,
        h: draggedNode.measured?.height ?? NODE_H,
      };

      let targetFolder: Node | null = null;
      for (const n of currentNodes) {
        if (n.type !== 'folder' || n.id === draggedNode.id) continue;
        const fw = n.measured?.width ?? NODE_W;
        const fh = n.measured?.height ?? NODE_H;
        if (
          dragRect.x < n.position.x + fw &&
          dragRect.x + dragRect.w > n.position.x &&
          dragRect.y < n.position.y + fh &&
          dragRect.y + dragRect.h > n.position.y
        ) {
          targetFolder = n;
          break;
        }
      }
      if (!targetFolder) return;

      const folderId = targetFolder.id;

      const childMeta: any = {
        name: String(draggedNode.data.label || ''),
        label: String(draggedNode.data.label || ''),
        type: draggedNode.type || 'file',
        extension: draggedNode.data.extension ? String(draggedNode.data.extension) : '',
        size: draggedNode.data.size ? String(draggedNode.data.size) : '',
        url: draggedNode.data.url ? String(draggedNode.data.url) : '',
        pageNumber: draggedNode.data.pageNumber,
        parentFile: draggedNode.data.parentFile,
      };

      if (draggedNode.type === 'folder') {
        childMeta.subChildren = (draggedNode.data.children as any[]) || [];
        childMeta.itemCount = (draggedNode.data.itemCount as number) || 0;
      }

      // Reroute edges
      let proxyCount = 0;

      setEdges((currentEdges) => {
        const proxies: Edge[] = [];
        const reroutedInfo = reroutedEdgesMap.get(folderId) || [];
        const remove = new Set<string>();

        for (const e of currentEdges) {
          if (e.source === draggedNode.id) {
            if (e.target !== folderId) {
              const pid = `proxy_${folderId}_abs_${e.id}`;
              proxies.push({ id: pid, source: folderId, target: e.target, animated: true, style: { stroke: 'var(--accent-primary)', strokeWidth: 2, strokeDasharray: '6 3' } });
              reroutedInfo.push({ reroutedEdgeId: pid, originalChildId: draggedNode.id, externalNodeId: e.target, direction: 'outgoing' });
            }
            remove.add(e.id);
          } else if (e.target === draggedNode.id) {
            if (e.source !== folderId) {
              const pid = `proxy_${folderId}_abs_${e.id}`;
              proxies.push({ id: pid, source: e.source, target: folderId, animated: true, style: { stroke: 'var(--accent-primary)', strokeWidth: 2, strokeDasharray: '6 3' } });
              reroutedInfo.push({ reroutedEdgeId: pid, originalChildId: draggedNode.id, externalNodeId: e.source, direction: 'incoming' });
            }
            remove.add(e.id);
          }
        }

        proxyCount = proxies.length;
        reroutedEdgesMap.set(folderId, reroutedInfo);
        return currentEdges.filter((e) => !remove.has(e.id)).concat(proxies);
      });

      // Remove dragged node, update folder
      setNodes((nds) => {
        const without = nds.filter((n) => n.id !== draggedNode.id);
        return without.map((n) => {
          if (n.id === folderId) {
            const prev = (n.data.children as any[]) || [];
            const updated = [...prev, childMeta];
            return {
              ...n,
              data: {
                ...n.data,
                children: updated,
                itemCount: updated.length,
                externalConnections: ((n.data.externalConnections as number) || 0) + proxyCount,
              },
            };
          }
          return n;
        });
      });
    },
    [setNodes, setEdges],
  );

  // ── edge disconnect ────────────────────────────────────
  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges],
  );

  const onReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));

        // If this was a folder→child edge, update the folder & child metadata
        setNodes((nds) => {
          const sourceNode = nds.find((n) => n.id === edge.source);
          if (
            sourceNode?.type === 'folder' &&
            ((sourceNode.data.childIds as string[]) || []).includes(edge.target)
          ) {
            const oldChildIds = (sourceNode.data.childIds as string[]) || [];
            const childIndex = oldChildIds.indexOf(edge.target);
            const newChildIds = oldChildIds.filter((cid) => cid !== edge.target);
            const oldChildren = (sourceNode.data.children as any[]) || [];
            const newChildren =
              childIndex >= 0
                ? oldChildren.filter((_, idx) => idx !== childIndex)
                : oldChildren;

            return nds.map((n) => {
              if (n.id === edge.source) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    childIds: newChildIds,
                    children: newChildren,
                    itemCount: newChildren.length,
                  },
                };
              }
              if (n.id === edge.target) {
                return {
                  ...n,
                  data: { ...n.data, parentFolder: undefined },
                };
              }
              return n;
            });
          }
          return nds;
        });
      }
      edgeReconnectSuccessful.current = true;
    },
    [setEdges, setNodes],
  );

  // ── sidebar drag-n-drop ────────────────────────────────
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // 1. OS file drops
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const rfType = event.dataTransfer.getData('application/reactflow');
        if (!rfType) {
          const osFiles = event.dataTransfer.files;
          const dropPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const positions = layoutNewNodes(dropPos.x, dropPos.y, osFiles.length);
          const newNodes: Node[] = [];

          for (let i = 0; i < osFiles.length; i++) {
            const f = osFiles[i];
            const nid = getId();
            recentlyCreatedNodeIds.add(nid);
            setTimeout(() => recentlyCreatedNodeIds.delete(nid), 500);
            fileBlobsMap.set(nid, f);
            newNodes.push({
              id: nid,
              type: 'file',
              position: positions[i],
              data: { label: getBaseName(f.name), extension: getFileExtension(f.name), size: formatFileSize(f.size) },
            });
          }
          setNodes((nds) => nds.concat(newNodes));
          return;
        }
      }

      // 2. Sidebar template drag
      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const nid = getId();

      // Mark as recently created to prevent instant absorption by onNodeDragStop
      recentlyCreatedNodeIds.add(nid);
      setTimeout(() => recentlyCreatedNodeIds.delete(nid), 500);

      const newNode: Node = { id: nid, type, position, data: { label } };

      if (type === 'file') {
        newNode.data.extension = 'TXT';
        newNode.data.size = '0 KB';
      } else if (type === 'folder') {
        newNode.data.itemCount = 0;
        newNode.data.expanded = false;
        newNode.data.children = [];
        newNode.data.childIds = [];
        newNode.data.externalConnections = 0;
      } else if (type === 'url') {
        newNode.data.url = 'https://';
      } else if (type === 'page') {
        newNode.data.pageNumber = 1;
        newNode.data.parentFile = 'Unknown Document';
      } else if (type === 'comment') {
        newNode.data.comment = '';
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  // ── import from sidebar buttons ────────────────────────
  const handleImportFiles = useCallback(
    (files: FileList) => {
      setNodes((currentNodes) => {
        const startY = bottomY(currentNodes);
        const positions = layoutNewNodes(100, startY, files.length);
        const newNodes: Node[] = [];

        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const nid = getId();
          fileBlobsMap.set(nid, f);
          newNodes.push({
            id: nid,
            type: 'file',
            position: positions[i],
            data: { label: getBaseName(f.name), extension: getFileExtension(f.name), size: formatFileSize(f.size) },
          });
        }
        return currentNodes.concat(newNodes);
      });
    },
    [setNodes],
  );

  const handleImportFolder = useCallback(
    (files: FileList) => {
      // Build a proper tree so subfolders show first
      const tree = buildFolderTree(files);

      setNodes((currentNodes) => {
        const startY = bottomY(currentNodes);
        // The top-level result is typically a single root folder (the selected folder)
        const positions = layoutNewNodes(100, startY, tree.length);

        const newNodes: Node[] = tree.map((tn, i) => {
          if (tn.type === 'folder') {
            const childrenMeta = treeToChildrenMeta(tn.children || []);
            return {
              id: getId(),
              type: 'folder' as const,
              position: positions[i],
              data: {
                label: tn.name,
                itemCount: childrenMeta.length,
                expanded: false,
                children: childrenMeta,
                childIds: [],
                externalConnections: 0,
              },
            };
          }
          return {
            id: getId(),
            type: 'file' as const,
            position: positions[i],
            data: {
              label: tn.name,
              extension: tn.extension || '',
              size: tn.size || '',
            },
          };
        });

        return currentNodes.concat(newNodes);
      });
    },
    [setNodes],
  );

  // ── node editing ───────────────────────────────────────
  const onUpdateNode = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
      );
    },
    [setNodes],
  );

  const selectedNode = nodes.find((n) => n.selected) || null;

  // ── context menu ───────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleCtxDelete = useCallback(() => {
    if (!contextMenu) return;
    const nid = contextMenu.nodeId;
    // If it's an expanded folder, also remove descendants
    const targetNode = nodesRef.current.find((n) => n.id === nid);
    const toRemove = new Set<string>([nid]);
    if (targetNode?.type === 'folder' && targetNode.data.expanded) {
      const collectAll = (parentId: string) => {
        const parent = nodesRef.current.find((n) => n.id === parentId);
        if (!parent) return;
        for (const cid of (parent.data.childIds as string[]) || []) {
          toRemove.add(cid);
          const child = nodesRef.current.find((n) => n.id === cid);
          if (child?.type === 'folder' && child.data.expanded) collectAll(cid);
        }
      };
      collectAll(nid);
      reroutedEdgesMap.delete(nid);
    }
    setNodes((nds) => nds.filter((n) => !toRemove.has(n.id)));
    setEdges((eds) => eds.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)));
    setContextMenu(null);
  }, [contextMenu, setNodes, setEdges]);

  const handleCtxDisconnectAll = useCallback(() => {
    if (!contextMenu) return;
    const nid = contextMenu.nodeId;
    setEdges((eds) => eds.filter((e) => e.source !== nid && e.target !== nid));
    setContextMenu(null);
  }, [contextMenu, setEdges]);

  const handleCtxDuplicate = useCallback(() => {
    if (!contextMenu) return;
    const original = nodesRef.current.find((n) => n.id === contextMenu.nodeId);
    if (!original) { setContextMenu(null); return; }
    const newId = getId();
    const clone: Node = {
      id: newId,
      type: original.type,
      position: { x: original.position.x + 30, y: original.position.y + 30 },
      data: { ...original.data },
    };
    // Don't copy folder expansion state or child references
    if (clone.type === 'folder') {
      clone.data = { ...clone.data, expanded: false, childIds: [], externalConnections: 0 };
    }
    recentlyCreatedNodeIds.add(newId);
    setTimeout(() => recentlyCreatedNodeIds.delete(newId), 500);
    setNodes((nds) => nds.concat(clone));
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  const handleCtxToggleExpand = useCallback(() => {
    if (!contextMenu) return;
    const targetNode = nodesRef.current.find((n) => n.id === contextMenu.nodeId);
    if (!targetNode || targetNode.type !== 'folder') { setContextMenu(null); return; }
    setContextMenu(null);
    // Trigger the same logic as double-click
    onNodeDoubleClick({} as React.MouseEvent, targetNode);
  }, [contextMenu, onNodeDoubleClick]);

  const handleCtxOpenFile = useCallback(() => {
    if (!contextMenu) return;
    const targetNode = nodesRef.current.find((n) => n.id === contextMenu.nodeId);
    if (!targetNode) { setContextMenu(null); return; }

    // URL nodes: open the URL directly
    if (targetNode.type === 'url' && targetNode.data.url) {
      const url = String(targetNode.data.url);
      const a = document.createElement('a');
      a.href = url.startsWith('http') ? url : `https://${url}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setContextMenu(null);
      return;
    }

    // File nodes: open the stored blob
    let fileBlob = fileBlobsMap.get(targetNode.id);
    // Fallback: try _fileKey stored in the node data
    if (!fileBlob && targetNode.data._fileKey) {
      fileBlob = fileBlobsMap.get(String(targetNode.data._fileKey));
    }
    // Fallback: try name.extension combo
    if (!fileBlob) {
      const ext = String(targetNode.data.extension || '').toLowerCase();
      const name = String(targetNode.data.label || '');
      const key = ext ? `${name}.${ext}` : name;
      fileBlob = fileBlobsMap.get(key);
    }
    if (fileBlob) {
      const ext = String(targetNode.data.extension || '').toLowerCase();
      // Extensions the browser can render natively in a new tab
      const browserViewable = new Set([
        'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico',
        'txt', 'html', 'htm', 'xml', 'json', 'css', 'js', 'csv',
        'mp4', 'webm', 'ogg', 'mp3', 'wav',
      ]);

      const objectUrl = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = objectUrl;

      if (browserViewable.has(ext)) {
        // Open in new tab — browser will render it
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        // Trigger download — OS will open in the correct app (Word, PowerPoint, etc.)
        a.download = fileBlob.name || `${String(targetNode.data.label || 'file')}.${ext}`;
      }

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } else {
      alert('No file data available. This file was not imported from your system.');
    }
    setContextMenu(null);
  }, [contextMenu]);

  const contextMenuNode = contextMenu ? nodesRef.current.find((n) => n.id === contextMenu.nodeId) : null;

  // ── render ─────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <Sidebar onImportFiles={handleImportFiles} onImportFolder={handleImportFolder} />
      <div style={{ flexGrow: 1, height: '100%' }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onReconnectStart={onReconnectStart}
          onReconnect={onReconnect}
          onReconnectEnd={onReconnectEnd}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={closeContextMenu}
          edgesReconnectable
          fitView
          style={{ background: 'var(--bg-color)' }}
        >
          <Background gap={16} size={1} color="var(--bg-dots)" />
          <Controls showInteractive={false} style={{ marginBottom: '20px' }} />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'file') return 'var(--color-file)';
              if (n.type === 'folder') return 'var(--color-folder)';
              if (n.type === 'url') return 'var(--color-url)';
              if (n.type === 'page') return 'var(--color-page)';
              if (n.type === 'comment') return 'var(--color-comment)';
              return 'var(--accent-primary)';
            }}
            maskColor="rgba(15, 17, 21, 0.8)"
            style={{ backgroundColor: 'var(--panel-bg)', bottom: '120px' }}
          />
        </ReactFlow>
      </div>
      <PropertiesPanel selectedNode={selectedNode} onUpdateNode={onUpdateNode} />

      {/* Context Menu */}
      {contextMenu && contextMenuNode && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeType={contextMenuNode.type || ''}
          isExpanded={!!contextMenuNode.data.expanded}
          onDelete={handleCtxDelete}
          onDisconnectAll={handleCtxDisconnectAll}
          onDuplicate={handleCtxDuplicate}
          onToggleExpand={contextMenuNode.type === 'folder' ? handleCtxToggleExpand : undefined}
          onOpenFile={(contextMenuNode.type === 'file' || contextMenuNode.type === 'url') ? handleCtxOpenFile : undefined}
          onClose={closeContextMenu}
        />
      )}

      {/* Title Panel & Actions */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute', bottom: '20px', left: '280px',
          padding: '10px 16px', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Finod Canvas</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Double-click folder to expand · Drag node onto folder to add</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid var(--panel-border)', paddingLeft: '20px' }}>
          <button
            onClick={async () => {
              if (exporting) return;
              setExporting(true);
              setExportProgress('Checking Ollama...');
              try {
                // Check Ollama status first
                const status = await checkOllamaStatus();
                if (!status.running) {
                  setExportProgress('❌ Ollama not running. Start it with: ollama serve');
                  setTimeout(() => { setExporting(false); setExportProgress(''); }, 5000);
                  return;
                }
                if (!status.modelAvailable) {
                  setExportProgress('❌ Model not found. Run: ollama pull llama3.1:8b');
                  setTimeout(() => { setExporting(false); setExportProgress(''); }, 5000);
                  return;
                }

                setExportProgress('Starting Q&A generation...');
                const jsonl = await exportToQAJsonl(nodes, edges, fileBlobsMap, (msg) => setExportProgress(msg));
                if (jsonl.trim()) {
                  downloadJsonl(jsonl, 'finod-qa-training.jsonl');
                  setExportProgress('✅ Export complete!');
                } else {
                  setExportProgress('No Q&A pairs generated.');
                }
              } catch (err) {
                console.error('Export failed:', err);
                setExportProgress(`❌ Export failed: ${(err as Error).message}`);
              }
              setTimeout(() => { setExporting(false); setExportProgress(''); }, 5000);
            }}
            disabled={exporting}
            style={{
              background: exporting ? '#374151' : 'linear-gradient(135deg, #059669, #10b981)',
              color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
              cursor: exporting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              opacity: exporting ? 0.7 : 1,
            }}
            onMouseOver={(e) => { if (!exporting) e.currentTarget.style.background = 'linear-gradient(135deg, #047857, #059669)'; }}
            onMouseOut={(e) => { if (!exporting) e.currentTarget.style.background = 'linear-gradient(135deg, #059669, #10b981)'; }}
          >
            {exporting ? '⏳ Generating Q&A...' : '🧠 Export Q&A JSONL'}
          </button>
          <button
            onClick={onSave}
            style={{
              background: 'var(--accent-primary)', color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
          >
            Save
          </button>
          <button
            onClick={onLoad}
            style={{
              background: 'var(--node-bg)', color: 'var(--text-primary)',
              border: '1px solid var(--node-border)', padding: '6px 14px',
              borderRadius: '6px', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--node-bg)')}
          >
            Load
          </button>
        </div>
        {exportProgress && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: '1px solid var(--panel-border)', paddingLeft: '12px' }}>
            {exportProgress}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}

export default App;
