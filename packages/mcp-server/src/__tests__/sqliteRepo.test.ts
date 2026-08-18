import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createNoteId,
  createNoteOperation,
  softDeleteNote,
  updateNoteOperation,
} from '@dripnex/core';
import { NodeSqliteNoteRepository } from '../sqliteRepo.js';

const SCHEMA = `
  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    notebook_id TEXT DEFAULT 'inbox',
    archived_at TEXT,
    is_pinned INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active'
  );
  CREATE TABLE notebooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  INSERT INTO notebooks (id, name) VALUES ('inbox', 'Inbox');
`;

describe('NodeSqliteNoteRepository + core ops', () => {
  let db: DatabaseSync;
  let repo: NodeSqliteNoteRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec(SCHEMA);
    repo = new NodeSqliteNoteRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a note through createNoteOperation', async () => {
    const result = await createNoteOperation({ content: '# Hello\n\nBody' }, repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Hello');

    const stored = await repo.get(result.data.id);
    expect(stored?.content).toBe('# Hello\n\nBody');
    expect(stored?.isDeleted).toBe(false);
  });

  it('updates content through updateNoteOperation', async () => {
    const created = await createNoteOperation({ content: '# Old' }, repo);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateNoteOperation(
      { id: created.data.id, content: '# New title\n\nChanged' },
      repo
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    // Structural title is kept unless the current one is still a placeholder.
    expect(updated.data.title).toBe('Old');
    expect(updated.data.content).toContain('Changed');
  });

  it('trashes with the domain softDeleteNote helper', async () => {
    const created = await createNoteOperation({ content: '# Bin me' }, repo);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const note = await repo.get(created.data.id);
    expect(note).not.toBeNull();
    await repo.save(softDeleteNote(note!));

    const trashed = await repo.get(createNoteId(created.data.id));
    expect(trashed?.isDeleted).toBe(true);
  });

  it('resolves a notebook by name', () => {
    expect(repo.findNotebookIdByName('Inbox')).toBe('inbox');
    expect(repo.findNotebookIdByName('Missing')).toBeNull();
  });
});
