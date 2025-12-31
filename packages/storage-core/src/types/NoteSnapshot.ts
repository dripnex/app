/**
 * Note Snapshot
 *
 * Represents a note for export/import operations.
 * This is a plain data structure, independent of domain logic.
 */

export interface NoteSnapshot {
  id: string;
  content: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  wordCount: number;
  archivedAt: string | null;
}
