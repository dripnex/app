import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations } from '@dripnex/storage-core';
import { createNote, createNoteId } from '@dripnex/core';
import { createInMemoryDatabase, type DatabaseConnection } from '../src/database.js';
import { allMigrations } from '../src/migrations/index.js';
import { SQLiteNoteRepository } from '../src/repositories/SQLiteNoteRepository.js';
import { SQLiteChunkRepository } from '../src/repositories/ChunkRepository.js';
import { hashChunkContent } from '../src/repositories/chunkHash.js';

describe('migrations', () => {
  it('has unique versions and embeddings is last by version', () => {
    const versions = allMigrations.map(m => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(Math.max(...versions)).toBe(20260817000002);
  });
});

describe('SQLiteChunkRepository', () => {
  let db: DatabaseConnection;
  let notes: SQLiteNoteRepository;
  let chunks: SQLiteChunkRepository;

  beforeEach(async () => {
    db = createInMemoryDatabase();
    runMigrations(db, allMigrations);
    notes = new SQLiteNoteRepository(db);
    chunks = new SQLiteChunkRepository(db);
    await notes.save(
      createNote({
        id: createNoteId('note-1'),
        content: '# Hello\n\nBody.',
      })
    );
  });

  afterEach(() => {
    db.close();
  });

  it('replaces and lists chunks for a note', async () => {
    const content = 'first passage';
    await chunks.replaceForNote('note-1', [
      {
        noteId: 'note-1',
        chunkIndex: 0,
        content,
        tokenCount: 4,
        contentHash: hashChunkContent(content),
      },
    ]);

    const listed = await chunks.listForNote('note-1');
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe('note-1:0');
    expect(listed[0]!.content).toBe(content);
    expect(listed[0]!.embedding).toBeNull();
    expect(await chunks.count()).toBe(1);
  });

  it('round-trips a float32 embedding', async () => {
    const vector = [0.25, -0.5, 1, 0];
    await chunks.replaceForNote('note-1', [
      {
        noteId: 'note-1',
        chunkIndex: 0,
        content: 'embedded',
        tokenCount: 2,
        contentHash: hashChunkContent('embedded'),
        embedding: vector,
        dim: 4,
        model: 'nomic-embed-text',
      },
    ]);

    const listed = await chunks.listEmbedded({ model: 'nomic-embed-text', dim: 4 });
    expect(listed).toHaveLength(1);
    expect(Array.from(listed[0]!.embedding!)).toEqual(vector);
    expect(listed[0]!.dim).toBe(4);
    expect(listed[0]!.model).toBe('nomic-embed-text');
  });

  it('cascades when the note is hard-deleted', async () => {
    await chunks.replaceForNote('note-1', [
      {
        noteId: 'note-1',
        chunkIndex: 0,
        content: 'gone',
        tokenCount: 1,
        contentHash: hashChunkContent('gone'),
      },
    ]);
    await notes.delete(createNoteId('note-1'));
    expect(await chunks.listForNote('note-1')).toEqual([]);
    expect(await chunks.count()).toBe(0);
  });

  it('save() writes chunks and keeps embeddings when the hash matches', async () => {
    const first = await chunks.listForNote('note-1');
    expect(first.length).toBeGreaterThan(0);

    const vector = [0.25, -0.5, 1];
    await chunks.replaceForNote('note-1', [
      {
        noteId: 'note-1',
        chunkIndex: 0,
        content: first[0]!.content,
        tokenCount: first[0]!.tokenCount,
        contentHash: first[0]!.contentHash,
        embedding: vector,
        dim: 3,
        model: 'nomic-embed-text',
      },
    ]);

    const note = await notes.get(createNoteId('note-1'));
    expect(note).not.toBeNull();
    await notes.save(note!);

    const after = await chunks.listForNote('note-1');
    expect(after[0]!.contentHash).toBe(first[0]!.contentHash);
    expect(Array.from(after[0]!.embedding!)).toEqual(vector);
  });

  it('lists pending chunks and stores an embedding', async () => {
    await chunks.replaceForNote('note-1', [
      {
        noteId: 'note-1',
        chunkIndex: 0,
        content: 'pending',
        tokenCount: 1,
        contentHash: hashChunkContent('pending'),
      },
    ]);
    const pending = await chunks.listPending(10);
    expect(pending).toHaveLength(1);
    expect(await chunks.countEmbedded({ model: 'nomic-embed-text', dim: 3 })).toBe(0);

    await chunks.updateEmbedding(pending[0]!.id, [0.25, -0.5, 1], {
      model: 'nomic-embed-text',
      dim: 3,
    });
    expect(await chunks.listPending(10)).toEqual([]);
    expect(await chunks.countEmbedded({ model: 'nomic-embed-text', dim: 3 })).toBe(1);
  });

  it('invalidateOtherModels drops vectors that do not match the active model', async () => {
    await chunks.replaceForNote('note-1', [
      {
        noteId: 'note-1',
        chunkIndex: 0,
        content: 'keep',
        tokenCount: 1,
        contentHash: hashChunkContent('keep'),
      },
    ]);
    const [row] = await chunks.listPending(1);
    await chunks.updateEmbedding(row!.id, [0.1, 0.2, 0.3], {
      model: 'nomic-embed-text',
      dim: 3,
    });
    expect(await chunks.invalidateOtherModels({ model: 'nomic-embed-text', dim: 3 })).toBe(0);
    expect(await chunks.countEmbedded({ model: 'nomic-embed-text', dim: 3 })).toBe(1);

    expect(await chunks.invalidateOtherModels({ model: 'text-embedding-3-small', dim: 1536 })).toBe(
      1
    );
    expect(await chunks.countEmbedded({ model: 'nomic-embed-text', dim: 3 })).toBe(0);
    expect(await chunks.listPending(10)).toHaveLength(1);
  });

  it('deleteForNote removes only that note', async () => {
    await notes.save(createNote({ id: createNoteId('note-2'), content: '# Other' }));
    await chunks.replaceForNote('note-1', [
      {
        noteId: 'note-1',
        chunkIndex: 0,
        content: 'a',
        tokenCount: 1,
        contentHash: hashChunkContent('a'),
      },
    ]);
    await chunks.replaceForNote('note-2', [
      {
        noteId: 'note-2',
        chunkIndex: 0,
        content: 'b',
        tokenCount: 1,
        contentHash: hashChunkContent('b'),
      },
    ]);
    await chunks.deleteForNote('note-1');
    expect(await chunks.listForNote('note-1')).toEqual([]);
    expect(await chunks.listForNote('note-2')).toHaveLength(1);
  });
});
