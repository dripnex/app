#!/usr/bin/env node

/**
 * Dripnex MCP Server
 *
 * Exposes Dripnex notes to Claude Code via the Model Context Protocol.
 * Reads directly from the local SQLite database using node:sqlite (Node 22.5+).
 *
 * Tools:
 *   - dripnex_list_notes: List notes with optional filters
 *   - dripnex_read_note: Read a specific note by ID or title
 *   - dripnex_search_notes: Search across notes (FTS5)
 *   - dripnex_list_notebooks: List all notebooks
 *   - dripnex_list_tags: List tags with note counts
 *
 * Writes (create/update/trash) are off unless DRIPNEX_MCP_WRITES=1.
 * Writes go through @dripnex/core operations + NoteRepository.
 * The desktop refetches on focus / dripnex.external-write.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createNoteId,
  createNoteOperation,
  trashNoteOperation,
  updateNoteOperation,
} from '@dripnex/core';
import type { Database } from './db.js';
import { openDb, resolveDbPath } from './db.js';
import { markExternalWrite, packageDirFromModuleUrl, readPackageVersion } from './notes.js';
import { NodeSqliteNoteRepository } from './sqliteRepo.js';

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

function writesEnabled(): boolean {
  return process.env.DRIPNEX_MCP_WRITES === '1';
}

function createServer(db: Database, options: { dbPath?: string } = {}) {
  const version = readPackageVersion(packageDirFromModuleUrl(import.meta.url));
  const server = new McpServer({
    name: 'dripnex',
    version,
  });
  const notes = new NodeSqliteNoteRepository(db);
  const afterWrite = () => {
    if (options.dbPath) markExternalWrite(options.dbPath);
  };
  const allowWrites = writesEnabled();

  // ── List notes ──────────────────────────────────────────────────────────

  server.registerTool(
    'dripnex_list_notes',
    {
      description: 'List notes in Dripnex. Returns titles, IDs, and metadata.',
      inputSchema: {
        notebook: z.string().optional().describe('Filter by notebook name'),
        limit: z.number().default(20).describe('Max notes to return'),
        includeTrash: z.boolean().default(false).describe('Include trashed notes'),
        status: z.enum(['active', 'on_hold', 'completed', 'dropped']).optional(),
      },
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

  server.registerTool(
    'dripnex_read_note',
    {
      description: 'Read the full content of a note by ID or title search.',
      inputSchema: {
        id: z.string().optional().describe('Note ID (exact match)'),
        title: z.string().optional().describe('Title to search for (FTS5)'),
      },
    },
    async ({ id, title }) => {
      let note: Record<string, unknown> | null = null;

      if (id) {
        note = queryOne(db, 'SELECT id, title, content, notebook_id FROM notes WHERE id = ?', [id]);
      } else if (title) {
        // Use FTS5 to find the best-matching live note by title.
        // Falls back to a parameterized LIKE if FTS produced no hit, so this
        // tool still works on freshly-restored DBs where the FTS index is empty.
        const ftsQuery = prepareFtsQuery(title);
        note = queryOne(
          db,
          `SELECT n.id, n.title, n.content, n.notebook_id
             FROM notes_fts
             JOIN notes n ON n.id = notes_fts.id
             WHERE notes_fts MATCH ? AND n.is_deleted = 0
             ORDER BY bm25(notes_fts) LIMIT 1`,
          [ftsQuery]
        );
        if (!note) {
          note = queryOne(
            db,
            `SELECT id, title, content, notebook_id
               FROM notes
              WHERE title LIKE '%' || ? || '%' AND is_deleted = 0
              ORDER BY updated_at DESC LIMIT 1`,
            [title]
          );
        }
      }

      if (!note) {
        return { content: [{ type: 'text' as const, text: 'Note not found.' }] };
      }

      return {
        content: [{ type: 'text' as const, text: `# ${note.title}\n\n${note.content}` }],
      };
    }
  );

  if (allowWrites) {
    // ── Create note ─────────────────────────────────────────────────────────

    server.registerTool(
      'dripnex_create_note',
      {
        description: 'Create a new note in Dripnex. Content should be markdown.',
        inputSchema: {
          content: z.string().describe('Markdown content for the note'),
          notebook: z.string().optional().describe('Notebook name (defaults to Inbox)'),
        },
      },
      async ({ content, notebook }) => {
        let notebookId: string | undefined;
        if (notebook) {
          const id = notes.findNotebookIdByName(notebook);
          if (!id) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Notebook "${notebook}" not found. Note was not created.`,
                },
              ],
              isError: true,
            };
          }
          notebookId = id;
        }

        const result = await createNoteOperation({ content, notebookId }, notes);
        if (!result.ok) {
          return {
            content: [{ type: 'text' as const, text: 'Failed to create note.' }],
            isError: true,
          };
        }
        afterWrite();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Note created: "${result.data.title}" (ID: ${result.data.id})`,
            },
          ],
        };
      }
    );

    // ── Update note ─────────────────────────────────────────────────────────

    server.registerTool(
      'dripnex_update_note',
      {
        description: 'Update an existing note. Replaces the full content.',
        inputSchema: {
          id: z.string().describe('Note ID'),
          content: z.string().describe('New markdown content'),
        },
      },
      async ({ id, content }) => {
        const result = await updateNoteOperation({ id: createNoteId(id), content }, notes);
        if (!result.ok) {
          return { content: [{ type: 'text' as const, text: 'Note not found.' }] };
        }
        afterWrite();

        return {
          content: [{ type: 'text' as const, text: `Note updated: "${result.data.title}"` }],
        };
      }
    );
  }

  // ── Search notes (FTS5) ──────────────────────────────────────────────────

  server.registerTool(
    'dripnex_search_notes',
    {
      description:
        'Full-text search across all notes using FTS5 with relevance ranking. Returns matching notes with snippets.',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().default(10),
      },
    },
    async ({ query: q, limit }) => {
      const trimmed = q.trim();
      if (!trimmed) {
        return { content: [{ type: 'text' as const, text: 'No results found.' }] };
      }

      const ftsQuery = prepareFtsQuery(trimmed);
      const results = query(
        db,
        `SELECT n.id, n.title, snippet(notes_fts, 2, '**', '**', '…', 32) as snippet
         FROM notes_fts
         JOIN notes n ON n.id = notes_fts.id
         WHERE notes_fts MATCH ? AND n.is_deleted = 0
         ORDER BY bm25(notes_fts) LIMIT ?`,
        [ftsQuery, limit]
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

  server.registerTool(
    'dripnex_list_notebooks',
    {
      description: 'List all notebooks in Dripnex.',
      inputSchema: {},
    },
    async () => {
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
    }
  );

  server.registerTool(
    'dripnex_list_tags',
    {
      description: 'List all tags in Dripnex with how many active notes use each.',
      inputSchema: {},
    },
    async () => {
      const tags = query(
        db,
        `SELECT t.name,
                COUNT(DISTINCT CASE WHEN n.is_deleted = 0 THEN n.id END) as note_count
         FROM tags t
         LEFT JOIN note_tags nt ON nt.tag_id = t.id
         LEFT JOIN notes n ON n.id = nt.note_id
         GROUP BY t.id
         ORDER BY t.name`
      );

      const text = tags.map(t => `- **${t.name}** (${t.note_count} notes)`).join('\n');

      return { content: [{ type: 'text' as const, text: text || 'No tags found.' }] };
    }
  );

  if (allowWrites) {
    server.registerTool(
      'dripnex_trash_note',
      {
        description: 'Move a note to trash (soft delete).',
        inputSchema: {
          id: z.string().describe('Note ID'),
        },
      },
      async ({ id }) => {
        const result = await trashNoteOperation({ id: createNoteId(id) }, notes);
        if (!result.ok) {
          return { content: [{ type: 'text' as const, text: 'Note not found.' }] };
        }
        afterWrite();

        return { content: [{ type: 'text' as const, text: 'Note moved to trash.' }] };
      }
    );
  }

  return server;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const dbPath = resolveDbPath();
  const db = openDb(dbPath);
  const server = createServer(db, { dbPath });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('MCP server error:', err);
  process.exit(1);
});

export { createServer };
