import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createNoteId,
  createNoteOperation,
  deleteNoteOperation,
  trashNoteOperation,
  updateNoteOperation,
} from '@dripnex/core';
import type { Database } from './db.js';
import type { LocalHttpChangeRecord } from './http.js';
import { NodeSqliteNoteRepository } from './sqliteRepo.js';
import {
  LocalHttpRequiredError,
  type McpDataStore,
  type NoteListRow,
  type NoteReadRow,
  type NoteSearchRow,
  type NotebookRow,
  type TagRow,
  type TemplateRow,
} from './store.js';

const CHANGES_FILE = 'changes.json';

function query(db: Database, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  return db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[];
}

function queryOne(
  db: Database,
  sql: string,
  params: unknown[] = []
): Record<string, unknown> | null {
  return (db.prepare(sql).get(...(params as never[])) as Record<string, unknown>) ?? null;
}

/** Escape and prepare a query string for FTS5 MATCH syntax */
function prepareFtsQuery(input: string): string {
  const escaped = input.replace(/["*^()]/g, ' ').trim();
  const terms = escaped.split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return '""';
  return terms.map(t => `"${t}"*`).join(' OR ');
}

export class SqliteStore implements McpDataStore {
  private readonly notes: NodeSqliteNoteRepository;

  constructor(
    private readonly db: Database,
    private readonly options: { dbPath?: string; version: string }
  ) {
    this.notes = new NodeSqliteNoteRepository(db);
  }

  async listNotes(input: {
    notebook?: string;
    limit: number;
    includeTrash: boolean;
    status?: string;
  }): Promise<NoteListRow[]> {
    let sql = `
        SELECT n.id, n.title, n.word_count, n.created_at, n.updated_at,
               n.is_pinned, n.is_deleted, n.status, n.notebook_id,
               nb.name as notebook_name
        FROM notes n
        LEFT JOIN notebooks nb ON n.notebook_id = nb.id
        WHERE 1=1
      `;
    const params: unknown[] = [];

    if (!input.includeTrash) {
      sql += ' AND n.is_deleted = 0';
    }
    if (input.notebook) {
      sql += ' AND nb.name = ?';
      params.push(input.notebook);
    }
    if (input.status) {
      sql += ' AND n.status = ?';
      params.push(input.status);
    }

    sql += ' ORDER BY n.updated_at DESC LIMIT ?';
    params.push(input.limit);

    return query(this.db, sql, params).map(n => ({
      id: String(n.id),
      title: String(n.title),
      word_count: Number(n.word_count),
      created_at: String(n.created_at),
      updated_at: String(n.updated_at),
      is_pinned: n.is_pinned as number,
      is_deleted: n.is_deleted as number,
      status: String(n.status),
      notebook_id: String(n.notebook_id),
      notebook_name: n.notebook_name == null ? null : String(n.notebook_name),
    }));
  }

  async readNote(input: { id?: string; title?: string }): Promise<NoteReadRow | null> {
    let note: Record<string, unknown> | null = null;

    if (input.id) {
      note = queryOne(this.db, 'SELECT id, title, content, notebook_id FROM notes WHERE id = ?', [
        input.id,
      ]);
    } else if (input.title) {
      const ftsQuery = prepareFtsQuery(input.title);
      note = queryOne(
        this.db,
        `SELECT n.id, n.title, n.content, n.notebook_id
             FROM notes_fts
             JOIN notes n ON n.id = notes_fts.id
             WHERE notes_fts MATCH ? AND n.is_deleted = 0
             ORDER BY bm25(notes_fts) LIMIT 1`,
        [ftsQuery]
      );
      if (!note) {
        note = queryOne(
          this.db,
          `SELECT id, title, content, notebook_id
               FROM notes
              WHERE title LIKE '%' || ? || '%' AND is_deleted = 0
              ORDER BY updated_at DESC LIMIT 1`,
          [input.title]
        );
      }
    }

    if (!note) return null;
    return {
      id: String(note.id),
      title: String(note.title),
      content: String(note.content),
      notebook_id: String(note.notebook_id),
    };
  }

  async searchNotes(q: string, limit: number): Promise<NoteSearchRow[]> {
    const ftsQuery = prepareFtsQuery(q);
    return query(
      this.db,
      `SELECT n.id, n.title, snippet(notes_fts, 2, '**', '**', '…', 32) as snippet
         FROM notes_fts
         JOIN notes n ON n.id = notes_fts.id
         WHERE notes_fts MATCH ? AND n.is_deleted = 0
         ORDER BY bm25(notes_fts) LIMIT ?`,
      [ftsQuery, limit]
    ).map(r => ({
      id: String(r.id),
      title: String(r.title),
      snippet: String(r.snippet ?? ''),
    }));
  }

  async listNotebooks(): Promise<NotebookRow[]> {
    return query(
      this.db,
      `SELECT nb.id, nb.name, nb.parent_id, COUNT(n.id) as note_count
         FROM notebooks nb
         LEFT JOIN notes n ON n.notebook_id = nb.id AND n.is_deleted = 0
         GROUP BY nb.id
         ORDER BY nb.name`
    ).map(nb => ({
      id: String(nb.id),
      name: String(nb.name),
      parent_id: nb.parent_id == null ? null : String(nb.parent_id),
      note_count: Number(nb.note_count),
    }));
  }

  async listTags(): Promise<TagRow[]> {
    return query(
      this.db,
      `SELECT t.name,
                COUNT(DISTINCT CASE WHEN n.is_deleted = 0 THEN n.id END) as note_count
         FROM tags t
         LEFT JOIN note_tags nt ON nt.tag_id = t.id
         LEFT JOIN notes n ON n.id = nt.note_id
         GROUP BY t.id
         ORDER BY t.name`
    ).map(t => ({
      name: String(t.name),
      note_count: Number(t.note_count),
    }));
  }

  async listTemplates(): Promise<TemplateRow[]> {
    return query(
      this.db,
      `SELECT id, title, content
           FROM notes
          WHERE notebook_id = 'templates' AND is_deleted = 0
          ORDER BY title`
    ).map(t => ({
      id: String(t.id),
      title: String(t.title),
      content: String(t.content ?? ''),
    }));
  }

  async findTemplate(name: string): Promise<TemplateRow | null> {
    const exact = queryOne(
      this.db,
      `SELECT id, title, content FROM notes
      WHERE notebook_id = 'templates' AND is_deleted = 0 AND title = ?
      LIMIT 1`,
      [name]
    );
    if (exact) {
      return { id: String(exact.id), title: String(exact.title), content: String(exact.content) };
    }
    const fuzzy = queryOne(
      this.db,
      `SELECT id, title, content FROM notes
      WHERE notebook_id = 'templates' AND is_deleted = 0 AND title LIKE '%' || ? || '%'
      ORDER BY updated_at DESC LIMIT 1`,
      [name]
    );
    if (!fuzzy) return null;
    return { id: String(fuzzy.id), title: String(fuzzy.title), content: String(fuzzy.content) };
  }

  async findNotebookIdByName(name: string): Promise<string | null> {
    return this.notes.findNotebookIdByName(name);
  }

  async createNote(input: { content: string; notebookId?: string }): Promise<{
    id: string;
    title: string;
  }> {
    const result = await createNoteOperation(input, this.notes);
    if (!result.ok) {
      throw new Error('Failed to create note.');
    }
    return { id: result.data.id, title: result.data.title };
  }

  async updateNote(id: string, content: string): Promise<{ title: string } | null> {
    const result = await updateNoteOperation({ id: createNoteId(id), content }, this.notes);
    if (!result.ok) return null;
    return { title: result.data.title };
  }

  async trashNote(id: string, permanent = false): Promise<boolean> {
    const noteId = createNoteId(id);
    const result = permanent
      ? await deleteNoteOperation({ id: noteId }, this.notes)
      : await trashNoteOperation({ id: noteId }, this.notes);
    return result.ok;
  }

  async status(): Promise<{ status: string; version: string; noteCount: number }> {
    const row = queryOne(this.db, 'SELECT COUNT(*) as c FROM notes WHERE is_deleted = 0');
    return {
      status: 'ok',
      version: this.options.version,
      noteCount: Number(row?.c ?? 0),
    };
  }

  async createNotebook(): Promise<{ id: string }> {
    throw new LocalHttpRequiredError('dripnex_create_notebook');
  }

  async updateNotebook(): Promise<boolean> {
    throw new LocalHttpRequiredError('dripnex_update_notebook');
  }

  async deleteNotebook(): Promise<boolean> {
    throw new LocalHttpRequiredError('dripnex_delete_notebook');
  }

  async createTag(): Promise<{ name: string }> {
    throw new LocalHttpRequiredError('dripnex_create_tag');
  }

  async updateTag(): Promise<boolean> {
    throw new LocalHttpRequiredError('dripnex_update_tag');
  }

  async getChanges(since: number): Promise<{
    results: LocalHttpChangeRecord[];
    last_seq: number;
  }> {
    const dbPath = this.options.dbPath;
    if (!dbPath || dbPath === ':memory:') {
      return { results: [], last_seq: 0 };
    }
    try {
      const raw = readFileSync(join(dirname(dbPath), CHANGES_FILE), 'utf8');
      const parsed = JSON.parse(raw) as { seq?: unknown; items?: unknown };
      if (typeof parsed.seq !== 'number' || !Array.isArray(parsed.items)) {
        return { results: [], last_seq: 0 };
      }
      const items: LocalHttpChangeRecord[] = [];
      for (const item of parsed.items) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Partial<LocalHttpChangeRecord>;
        if (typeof rec.seq !== 'number' || typeof rec.id !== 'string') continue;
        if (rec.kind !== 'note' && rec.kind !== 'book' && rec.kind !== 'tag') continue;
        items.push({
          seq: rec.seq,
          id: rec.id,
          kind: rec.kind,
          deleted: rec.deleted === true ? true : undefined,
        });
      }
      return {
        results: items.filter(item => item.seq > since),
        last_seq: parsed.seq,
      };
    } catch {
      return { results: [], last_seq: 0 };
    }
  }
}
