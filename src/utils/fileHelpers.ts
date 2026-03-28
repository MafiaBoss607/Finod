/**
 * Utility helpers for file import logic.
 */

/** Format raw byte count into a human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Extract the extension from a filename (uppercase, without the dot). */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toUpperCase();
}

/** Extract the base name (without extension) from a filename. */
export function getBaseName(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return filename;
  return parts.slice(0, -1).join('.');
}
