/**
 * Core domain types for Readied
 * These are the fundamental building blocks of the note system
 */

/** Branded type for Note IDs to prevent mixing with plain strings */
export type NoteId = string & { readonly __brand: 'NoteId' };

/** Creates a new NoteId from a string */
export function createNoteId(id: string): NoteId {
  return id as NoteId;
}

/** Generates a new unique NoteId */
export function generateNoteId(): NoteId {
  // crypto is available in Node.js 19+, Electron, and all modern browsers
  const cryptoModule = (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto;
  return cryptoModule.randomUUID() as NoteId;
}

/** ISO 8601 timestamp string */
export type Timestamp = string & { readonly __brand: 'Timestamp' };

/** Creates a Timestamp from a Date or uses current time */
export function createTimestamp(date?: Date): Timestamp {
  return (date ?? new Date()).toISOString() as Timestamp;
}

/** Tag extracted from note content (e.g., #javascript) */
export type Tag = string & { readonly __brand: 'Tag' };

/** Creates a Tag, normalizing to lowercase without the # prefix */
export function createTag(raw: string): Tag {
  const normalized = raw.replace(/^#/, '').toLowerCase().trim();
  return normalized as Tag;
}
