/**
 * Extract text content from various file types.
 * Supports PDF, DOCX, PPTX, and plain text formats.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure pdf.js worker using the bundled worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Extract text from a PDF file using pdf.js */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

/** Extract text from a DOCX file using mammoth */
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/** Extract text from a PPTX file by unzipping and parsing slide XML */
async function extractPptxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Find all slide files (ppt/slides/slide1.xml, slide2.xml, etc.)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/i)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)/i)?.[1] || '0');
      return numA - numB;
    });

  const slides: string[] = [];

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async('text');
    // Extract text content from XML tags like <a:t>text</a:t>
    const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    const slideText = textMatches
      .map((match) => match.replace(/<\/?a:t[^>]*>/g, ''))
      .join(' ');
    if (slideText.trim()) {
      slides.push(slideText.trim());
    }
  }

  return slides.join('\n\n');
}

/** Extract text from an XLSX file by parsing sheet XML */
async function extractXlsxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Read shared strings (XLSX stores text in a shared strings table)
  const sharedStringsFile = zip.files['xl/sharedStrings.xml'];
  const sharedStrings: string[] = [];
  if (sharedStringsFile) {
    const xml = await sharedStringsFile.async('text');
    const matches = xml.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
    for (const match of matches) {
      sharedStrings.push(match.replace(/<\/?t[^>]*>/g, ''));
    }
  }

  // Find sheet files
  const sheetFiles = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort();

  const sheets: string[] = [];
  for (const sheetPath of sheetFiles) {
    const xml = await sheetPath ? await zip.files[sheetPath].async('text') : '';
    // Extract cell values — inline strings
    const inlineMatches = xml.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
    const texts = inlineMatches.map((m) => m.replace(/<\/?t[^>]*>/g, ''));
    if (texts.length > 0) {
      sheets.push(texts.join('\t'));
    }
  }

  return sharedStrings.length > 0
    ? sharedStrings.join('\t') + '\n' + sheets.join('\n')
    : sheets.join('\n');
}

/** Plain text extraction for text-based formats */
async function extractPlainText(file: File): Promise<string> {
  return await file.text();
}

// Extensions grouped by extraction method
const PLAIN_TEXT_EXTENSIONS = new Set([
  'txt', 'csv', 'json', 'html', 'htm', 'xml', 'css', 'js', 'ts',
  'md', 'yaml', 'yml', 'ini', 'cfg', 'log', 'py', 'java', 'c',
  'cpp', 'h', 'rb', 'go', 'rs', 'sql', 'sh', 'bat', 'ps1',
]);

/**
 * Extract text content from a file based on its extension.
 * Returns the extracted text, or a placeholder for unsupported types.
 */
export async function extractText(file: File, extension: string): Promise<string> {
  const ext = extension.toLowerCase();

  try {
    if (ext === 'pdf') {
      return await extractPdfText(file);
    }
    if (ext === 'docx') {
      return await extractDocxText(file);
    }
    if (ext === 'doc') {
      return '[.doc format not supported — please convert to .docx]';
    }
    if (ext === 'pptx') {
      return await extractPptxText(file);
    }
    if (ext === 'ppt') {
      return '[.ppt format not supported — please convert to .pptx]';
    }
    if (ext === 'xlsx') {
      return await extractXlsxText(file);
    }
    if (ext === 'xls') {
      return '[.xls format not supported — please convert to .xlsx]';
    }
    if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
      return await extractPlainText(file);
    }

    // Images, videos, etc. — no text to extract
    return `[Binary file (${ext}) — no text extracted]`;
  } catch (err) {
    console.error(`Error extracting text from ${file.name}:`, err);
    return `[Error extracting text: ${(err as Error).message}]`;
  }
}
