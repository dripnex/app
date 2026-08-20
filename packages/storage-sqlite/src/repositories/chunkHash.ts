import { createHash } from 'node:crypto';

export function hashChunkContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function chunkRowId(noteId: string, chunkIndex: number): string {
  return `${noteId}:${chunkIndex}`;
}

export function embeddingToBlob(values: ArrayLike<number>): Buffer {
  const copy = new Float32Array(values.length);
  copy.set(values);
  return Buffer.from(copy.buffer);
}

export function blobToEmbedding(blob: Buffer): Float32Array {
  const bytes = new Uint8Array(blob.byteLength);
  bytes.set(blob);
  return new Float32Array(bytes.buffer);
}
