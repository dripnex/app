#!/usr/bin/env node

/**
 * Readied MCP Server
 *
 * Exposes Readied notes to Claude Code via the Model Context Protocol.
 * Reads directly from the local SQLite database using better-sqlite3.
 *
 * Tools:
 *   - readied_list_notes: List notes with optional filters
 *   - readied_read_note: Read a specific note by ID or title
 *   - readied_create_note: Create a new note
 *   - readied_update_note: Update an existing note
 *   - readied_search_notes: Search across notes (FTS5)
 *   - readied_list_notebooks: List all notebooks
 *   - readied_trash_note: Move a note to trash
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { openDb } from './db.js';

/** Helper: run a SELECT and return rows as objects */
function query(
  db: Database.Database,
  sql: string,
  params: unknown[] = []
): Record<string, unknown>[] {
  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

/** Helper: run a single SELECT and return first row */
function queryOne(
  db: Database.Database,
  sql: string,
  params: unknown[] = []
): Record<string, unknown> | null {
  return (db.prepare(sql).get(...params) as Record<string, unknown>) ?? null;
}

/** Helper: run INSERT/UPDATE/DELETE and return rows changed */
function execute(db: Database.Database, sql: string, params: unknown[] = []): number {
  return db.prepare(sql).run(...params).changes;
}

function createServer(db: Database.Database) {
  const server = new McpServer({
    name: 'readied',
    version: '0.1.0',
  });

  // ── List notes ──────────────────────────────────────────────────────────

  server.tool(
    'readied_list_notes',
    'List notes in Readied. Returns titles, IDs, and metadata.',
    {
      notebook: z.string().optional().describe('Filter by notebook name'),
      limit: z.number().default(20).describe('Max notes to return'),
      includeTrash: z.boolean().default(false).describe('Include trashed notes'),
      status: z.enum(['active', 'on_hold', 'completed', 'dropped']).optional(),
    },
    async ({ notebook, limit, includeTrash, status }) => {
      let sql = `
        SELECT n.id, n.title, n.word_count, n.created_at, n.updated_at,
               n.is_pinned, n.is_deleted, n.status, n.notebook_id,
               nb.name as notebook_name
        FROM notes n
        LEFT JOIN notebooks nb ON n.notebook_id = nb.id
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (!includeTrash) {
        sql += ' AND n.is_deleted = 0';
      }
      if (notebook) {
        sql += ' AND nb.name = ?';
        params.push(notebook);
      }
      if (status) {
        sql += ' AND n.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY n.updated_at DESC LIMIT ?';
      params.push(limit);

      const notes = query(db, sql, params);

      const text = notes
        .map(
          n =>
            `- **${n.title}** (${n.word_count} words)\n  ID: ${n.id}\n  Notebook: ${n.notebook_name || 'Inbox'} | Status: ${n.status}${n.is_pinned ? ' | Pinned' : ''}\n  Updated: ${n.updated_at}`
        )
        .join('\n\n');

      return { content: [{ type: 'text' as const, text: text || 'No notes found.' }] };
    }
  );

  // ── Read note ───────────────────────────────────────────────────────────

  server.tool(
    'readied_read_note',
    'Read the full content of a note by ID or title search.',
    {
      id: z.string().optional().describe('Note ID (exact match)'),
      title: z.string().optional().describe('Title to search for (partial match)'),
    },
    async ({ id, title }) => {
      let note: Record<string, unknown> | null = null;

      if (id) {
        note = queryOne(db, 'SELECT id, title, content, notebook_id FROM notes WHERE id = ?', [id]);
      } else if (title) {
        note = queryOne(
          db,
          'SELECT id, title, content, notebook_id FROM notes WHERE title LIKE ? AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1',
          [`%${title}%`]
        );
      }

      if (!note) {
        return { content: [{ type: 'text' as const, text: 'Note not found.' }] };
      }

      return {
        content: [{ type: 'text' as const, text: `# ${note.title}\n\n${note.content}` }],
      };
    }
  );

  // ── Create note ─────────────────────────────────────────────────────────

  server.tool(
    'readied_create_note',
    'Create a new note in Readied. Content should be markdown.',
    {
      content: z.string().describe('Markdown content for the note'),
      notebook: z.string().optional().describe('Notebook name (defaults to Inbox)'),
    },
    async ({ content, notebook }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const titleMatch = content.match(/^#+ (.+)$/m);
      const title = titleMatch?.[1]
        ? titleMatch[1].trim()
        : content.split('\n')[0]?.slice(0, 100) || 'Untitled';
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      let notebookId = 'inbox';
      if (notebook) {
        const nb = queryOne(db, 'SELECT id FROM notebooks WHERE name = ? LIMIT 1', [notebook]);
        if (nb) notebookId = nb.id as string;
      }

      execute(
        db,
        `INSERT INTO notes (id, content, title, created_at, updated_at, word_count, notebook_id, status, needs_sync, local_version, sync_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, 0)`,
        [id, content, title, now, now, wordCount, notebookId]
      );

      return {
        content: [{ type: 'text' as const, text: `Note created: "${title}" (ID: ${id})` }],
      };
    }
  );

  // ── Update note ─────────────────────────────────────────────────────────

  server.tool(
    'readied_update_note',
    'Update an existing note. Replaces the full content.',
    {
      id: z.string().describe('Note ID'),
      content: z.string().describe('New markdown content'),
    },
    async ({ id, content }) => {
      const now = new Date().toISOString();
      const titleMatch = content.match(/^#+ (.+)$/m);
      const title = titleMatch?.[1]
        ? titleMatch[1].trim()
        : content.split('\n')[0]?.slice(0, 100) || 'Untitled';
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      const changes = execute(
        db,
        'UPDATE notes SET content = ?, title = ?, updated_at = ?, word_count = ?, needs_sync = 1, local_version = local_version + 1 WHERE id = ?',
        [content, title, now, wordCount, id]
      );

      if (changes === 0) {
        return { content: [{ type: 'text' as const, text: 'Note not found.' }] };
      }

      return { content: [{ type: 'text' as const, text: `Note updated: "${title}"` }] };
    }
  );

  // ── Search notes ────────────────────────────────────────────────────────

  server.tool(
    'readied_search_notes',
    'Search across all notes by content or title. Returns matching notes with snippets.',
    {
      query: z.string().describe('Search query'),
      limit: z.number().default(10),
    },
    async ({ query: q, limit }) => {
      const results = query(
        db,
        `SELECT id, title, substr(content, 1, 300) as snippet
         FROM notes
         WHERE (content LIKE ? OR title LIKE ?) AND is_deleted = 0
         ORDER BY updated_at DESC LIMIT ?`,
        [`%${q}%`, `%${q}%`, limit]
      );

      if (results.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No results found.' }] };
      }

      const text = results
        .map(
          r =>
            `- **${r.title}** (${r.id})\n  ${(r.snippet as string).replace(/\n/g, ' ').slice(0, 150)}...`
        )
        .join('\n\n');

      return { content: [{ type: 'text' as const, text }] };
    }
  );

  // ── List notebooks ──────────────────────────────────────────────────────

  server.tool('readied_list_notebooks', 'List all notebooks in Readied.', {}, async () => {
    const notebooks = query(
      db,
      `SELECT nb.id, nb.name, nb.parent_id, COUNT(n.id) as note_count
         FROM notebooks nb
         LEFT JOIN notes n ON n.notebook_id = nb.id AND n.is_deleted = 0
         GROUP BY nb.id
         ORDER BY nb.name`
    );

    const text = notebooks
      .map(nb => `- **${nb.name}** (${nb.note_count} notes) — ID: ${nb.id}`)
      .join('\n');

    return { content: [{ type: 'text' as const, text: text || 'No notebooks found.' }] };
  });

  // ── Trash note ──────────────────────────────────────────────────────────

  server.tool(
    'readied_trash_note',
    'Move a note to trash (soft delete).',
    {
      id: z.string().describe('Note ID'),
    },
    async ({ id }) => {
      const changes = execute(
        db,
        'UPDATE notes SET is_deleted = 1, updated_at = ?, needs_sync = 1 WHERE id = ?',
        [new Date().toISOString(), id]
      );

      if (changes === 0) {
        return { content: [{ type: 'text' as const, text: 'Note not found.' }] };
      }

      return { content: [{ type: 'text' as const, text: 'Note moved to trash.' }] };
    }
  );

  return server;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const db = openDb();
  const server = createServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('MCP server error:', err);
  process.exit(1);
});

export { createServer };
