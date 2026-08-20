import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createNoteId,
  createNoteOperation,
  trashNoteOperation,
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
  CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE note_tags (
    note_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    source TEXT,
    UNIQUE(note_id, tag_id, source)
  );
  CREATE TABLE chunks (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    embedding BLOB,
    dim INTEGER,
    model TEXT,
    updated_at INTEGER NOT NULL
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

    const stored = await repo.get(createNoteId(result.data.id));
    expect(stored?.content).toBe('# Hello\n\nBody');
    expect(stored?.isDeleted).toBe(false);
  });

  it('updates content through updateNoteOperation', async () => {
    const created = await createNoteOperation({ content: '# Old' }, repo);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateNoteOperation(
      { id: createNoteId(created.data.id), content: '# New title\n\nChanged' },
      repo
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    // Structural title is kept unless the current one is still a placeholder.
    expect(updated.data.title).toBe('Old');
    expect(updated.data.content).toContain('Changed');
  });

  it('trashes through trashNoteOperation', async () => {
    const created = await createNoteOperation({ content: '# Bin me' }, repo);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await trashNoteOperation({ id: createNoteId(created.data.id) }, repo);
    expect(result.ok).toBe(true);

    const trashed = await repo.get(createNoteId(created.data.id));
    expect(trashed?.isDeleted).toBe(true);
  });

  it('persists extracted tags and chunks on save', async () => {
    const created = await createNoteOperation(
      { content: '# Ship\n\nWork on #javascript and #rust' },
      repo
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stored = await repo.get(createNoteId(created.data.id));
    expect(stored?.metadata.tags.map(tag => String(tag))).toEqual(
      expect.arrayContaining(['javascript', 'rust'])
    );

    const chunks = db
      .prepare('SELECT chunk_index, content FROM chunks WHERE note_id = ? ORDER BY chunk_index')
      .all(created.data.id) as Array<{ chunk_index: number; content: string }>;
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.content).toContain('javascript');
  });

  it('resolves a notebook by name', () => {
    expect(repo.findNotebookIdByName('Inbox')).toBe('inbox');
    expect(repo.findNotebookIdByName('Missing')).toBeNull();
  });
});
