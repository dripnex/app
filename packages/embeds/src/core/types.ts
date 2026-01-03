/**
 * Embed Types
 *
 * Core types for embed references.
 */

/**
 * Reference to an embedded file.
 * Extracted from ![[filename]] or ![[filename|display]] syntax.
 */
export interface EmbedRef {
  /** Filename or path (e.g., "diagram.png", "docs/spec.pdf") */
  target: string;
  /** Optional display text */
  display?: string;
}

/**
 * Supported embed types based on file extension.
 */
export type EmbedType = 'image' | 'video' | 'audio' | 'pdf' | 'unknown';

/**
 * Get embed type from filename.
 */
export function getEmbedType(filename: string): EmbedType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';

  return 'unknown';
}
