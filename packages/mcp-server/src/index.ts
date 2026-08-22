#!/usr/bin/env node

/**
 * Dripnex MCP Server
 *
 * Exposes Dripnex notes via the Model Context Protocol.
 * Prefers Dripnex Local HTTP when DRIPNEX_LOCAL_SERVER_URL +
 * DRIPNEX_LOCAL_TOKEN are set; otherwise reads the local SQLite file.
 *
 * Tools:
 *   - dripnex_status, dripnex_list_notes, dripnex_read_note, dripnex_search_notes
 *   - dripnex_list_notebooks, dripnex_create_notebook, dripnex_update_notebook,
 *     dripnex_delete_notebook
 *   - dripnex_list_tags, dripnex_create_tag, dripnex_update_tag
 *   - dripnex_list_templates, dripnex_get_changes
 *   - dripnex_create_note, dripnex_update_note, dripnex_trash_note
 *
 * Writes (create/update/trash/delete) are off unless Settings → Integrations
 * enables them (mcp.json next to the DB) or DRIPNEX_MCP_WRITES=1.
 * Enabling Local HTTP is not a write grant — that toggle only starts the
 * loopback listener. The HTTP API itself accepts writes with a Bearer token;
 * MCP tools still check the write gate first.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { applyTemplateFrontmatter, noteInstruction } from '@dripnex/core';
import type { Database } from './db.js';
import { openDb, resolveDbPath, tryResolveDbPath } from './db.js';
import { LocalHttpClient, LocalHttpError, resolveLocalHttpConfig } from './http.js';
import { HttpStore } from './httpStore.js';
import { markExternalWrite, packageDirFromModuleUrl, readPackageVersion } from './notes.js';
import { SqliteStore } from './sqliteStore.js';
import { LocalHttpRequiredError, type McpDataStore, type NoteListRow } from './store.js';
import { writesDisabledMessage, writesEnabled } from './writes.js';

export function createServer(
  db: Database | null,
  options: { dbPath?: string; http?: LocalHttpClient } = {}
) {
  const version = readPackageVersion(packageDirFromModuleUrl(import.meta.url));
  const server = new McpServer({
    name: 'dripnex',
    version,
  });
  const store: McpDataStore = options.http
    ? new HttpStore(options.http)
    : db
      ? new SqliteStore(db, { dbPath: options.dbPath, version })
      : (() => {
          throw new Error('createServer requires a database or a Local HTTP client');
        })();
  const afterWrite = () => {
    if (options.http) return;
    if (options.dbPath) markExternalWrite(options.dbPath);
  };
  const denyWrites = () => ({
    content: [{ type: 'text' as const, text: writesDisabledMessage() }],
    isError: true,
  });
  const allowWrites = () => writesEnabled(options.dbPath);

  const runTool = async (
    fn: () => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
  ) => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof LocalHttpError || err instanceof LocalHttpRequiredError) {
        return { content: [{ type: 'text' as const, text: err.message }], isError: true };
      }
      const message = err instanceof Error ? err.message : 'Unexpected error';
      return { content: [{ type: 'text' as const, text: message }], isError: true };
    }
  };

  server.registerTool(
    'dripnex_status',
    {
      description: 'Local HTTP / app status: version and note count (GET /api/status).',
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const status = await store.status();
        return {
          content: [
            {
              type: 'text',
              text: `status: ${status.status}\nversion: ${status.version}\nnoteCount: ${status.noteCount}`,
            },
          ],
        };
      })
  );

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
    async ({ notebook, limit, includeTrash, status }) =>
      runTool(async () => {
        const notes = await store.listNotes({ notebook, limit, includeTrash, status });
        return { content: [{ type: 'text', text: formatNoteList(notes) }] };
      })
  );

  server.registerTool(
    'dripnex_read_note',
    {
      description: 'Read the full content of a note by ID or title search.',
      inputSchema: {
        id: z.string().optional().describe('Note ID (exact match)'),
        title: z.string().optional().describe('Title to search for (FTS5)'),
      },
    },
    async ({ id, title }) =>
      runTool(async () => {
        const note = await store.readNote({ id, title });
        if (!note) {
          return { content: [{ type: 'text', text: 'Note not found.' }] };
        }
        return {
          content: [{ type: 'text', text: `# ${note.title}\n\n${note.content}` }],
        };
      })
  );

  server.registerTool(
    'dripnex_create_note',
    {
      description:
        'Create a new note in Dripnex. Pass template to copy a Templates notebook note, including its instruction: frontmatter.',
      inputSchema: {
        content: z
          .string()
          .optional()
          .describe('Markdown body. Combined with template instruction when both are set.'),
        template: z.string().optional().describe('Template title from the Templates notebook'),
        notebook: z.string().optional().describe('Notebook name (defaults to Inbox)'),
      },
    },
    async ({ content, template, notebook }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();

        let markdown = content ?? '';
        if (template) {
          const found = await store.findTemplate(template);
          if (!found) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Template "${template}" not found. Note was not created.`,
                },
              ],
              isError: true,
            };
          }
          markdown = content ? applyTemplateFrontmatter(found.content, content) : found.content;
        } else if (!content) {
          return {
            content: [{ type: 'text', text: 'Provide content or a template name.' }],
            isError: true,
          };
        }

        let notebookId: string | undefined;
        if (notebook) {
          const id = await store.findNotebookIdByName(notebook);
          if (!id) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Notebook "${notebook}" not found. Note was not created.`,
                },
              ],
              isError: true,
            };
          }
          notebookId = id;
        }

        const created = await store.createNote({ content: markdown, notebookId });
        afterWrite();
        return {
          content: [
            {
              type: 'text',
              text: `Note created: "${created.title}" (ID: ${created.id})`,
            },
          ],
        };
      })
  );

  server.registerTool(
    'dripnex_update_note',
    {
      description: 'Update an existing note. Replaces the full content.',
      inputSchema: {
        id: z.string().describe('Note ID'),
        content: z.string().describe('New markdown content'),
      },
    },
    async ({ id, content }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();

        const updated = await store.updateNote(id, content);
        if (!updated) {
          return { content: [{ type: 'text', text: 'Note not found.' }] };
        }
        afterWrite();
        return {
          content: [{ type: 'text', text: `Note updated: "${updated.title}"` }],
        };
      })
  );

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
    async ({ query: q, limit }) =>
      runTool(async () => {
        const trimmed = q.trim();
        if (!trimmed) {
          return { content: [{ type: 'text', text: 'No results found.' }] };
        }

        const results = await store.searchNotes(trimmed, limit);
        if (results.length === 0) {
          return { content: [{ type: 'text', text: 'No results found.' }] };
        }

        const text = results
          .map(
            r => `- **${r.title}** (${r.id})\n  ${r.snippet.replace(/\n/g, ' ').slice(0, 150)}...`
          )
          .join('\n\n');

        return { content: [{ type: 'text', text }] };
      })
  );

  server.registerTool(
    'dripnex_list_notebooks',
    {
      description: 'List all notebooks in Dripnex (GET /api/books).',
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const notebooks = await store.listNotebooks();
        const text = notebooks
          .map(nb => {
            const count = nb.note_count != null ? ` (${nb.note_count} notes)` : '';
            const extra = [
              nb.parent_id ? `parent: ${nb.parent_id}` : null,
              nb.icon ? `icon: ${nb.icon}` : null,
            ]
              .filter(Boolean)
              .join(', ');
            const suffix = extra ? ` (${extra})` : '';
            return `- **${nb.name}**${count} — ID: ${nb.id}${suffix}`;
          })
          .join('\n');

        return { content: [{ type: 'text', text: text || 'No notebooks found.' }] };
      })
  );

  server.registerTool(
    'dripnex_create_notebook',
    {
      description: 'Create a notebook (POST /api/books).',
      inputSchema: {
        name: z.string().describe('Notebook name'),
        parentId: z.string().optional().describe('Parent notebook ID'),
      },
    },
    async ({ name, parentId }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();
        const created = await store.createNotebook({ name, parentId });
        afterWrite();
        return {
          content: [{ type: 'text', text: `Notebook created (ID: ${created.id})` }],
        };
      })
  );

  server.registerTool(
    'dripnex_update_notebook',
    {
      description: 'Rename a notebook or set its icon (PUT /api/books/:id).',
      inputSchema: {
        id: z.string().describe('Notebook ID'),
        name: z.string().optional().describe('New name'),
        icon: z.string().nullable().optional().describe('Icon, or null to clear'),
      },
    },
    async ({ id, name, icon }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();
        if (name === undefined && icon === undefined) {
          return {
            content: [{ type: 'text', text: 'Provide name or icon.' }],
            isError: true,
          };
        }
        const ok = await store.updateNotebook(id, { name, icon });
        if (!ok) {
          return { content: [{ type: 'text', text: 'Notebook not found.' }] };
        }
        afterWrite();
        return { content: [{ type: 'text', text: 'Notebook updated.' }] };
      })
  );

  server.registerTool(
    'dripnex_delete_notebook',
    {
      description: 'Delete a notebook (DELETE /api/books/:id).',
      inputSchema: {
        id: z.string().describe('Notebook ID'),
      },
    },
    async ({ id }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();
        const ok = await store.deleteNotebook(id);
        if (!ok) {
          return { content: [{ type: 'text', text: 'Notebook not found.' }] };
        }
        afterWrite();
        return { content: [{ type: 'text', text: 'Notebook deleted.' }] };
      })
  );

  server.registerTool(
    'dripnex_list_templates',
    {
      description:
        'List notes in the Templates notebook, including any instruction: frontmatter for agents.',
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const templates = await store.listTemplates();
        if (templates.length === 0) {
          return { content: [{ type: 'text', text: 'No templates found.' }] };
        }
        const text = templates
          .map(t => {
            const instruction = noteInstruction(String(t.content ?? ''));
            const line = `- **${t.title}** — ID: ${t.id}`;
            return instruction
              ? `${line}\n  instruction: ${instruction.replace(/\n/g, ' ')}`
              : line;
          })
          .join('\n');
        return { content: [{ type: 'text', text }] };
      })
  );

  server.registerTool(
    'dripnex_list_tags',
    {
      description: 'List all tags in Dripnex (GET /api/tags).',
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const tags = await store.listTags();
        const text = tags
          .map(t => {
            if (t.note_count != null) return `- **${t.name}** (${t.note_count} notes)`;
            return t.color ? `- **${t.name}** (${t.color})` : `- **${t.name}**`;
          })
          .join('\n');
        return { content: [{ type: 'text', text: text || 'No tags found.' }] };
      })
  );

  server.registerTool(
    'dripnex_create_tag',
    {
      description: 'Create a tag, optionally with a color (POST /api/tags).',
      inputSchema: {
        name: z.string().describe('Tag name'),
        color: z.string().nullable().optional().describe('Color, or null'),
      },
    },
    async ({ name, color }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();
        const created = await store.createTag({ name, color });
        afterWrite();
        return {
          content: [{ type: 'text', text: `Tag saved: ${created.name}` }],
        };
      })
  );

  server.registerTool(
    'dripnex_update_tag',
    {
      description: 'Rename a tag or change its color (PUT /api/tags/:name).',
      inputSchema: {
        name: z.string().describe('Current tag name'),
        newName: z.string().optional().describe('New name'),
        color: z.string().nullable().optional().describe('Color, or null to clear'),
      },
    },
    async ({ name, newName, color }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();
        if (newName === undefined && color === undefined) {
          return {
            content: [{ type: 'text', text: 'Provide color or newName.' }],
            isError: true,
          };
        }
        const ok = await store.updateTag(name, { color, newName });
        if (!ok) {
          return { content: [{ type: 'text', text: 'Tag not found.' }] };
        }
        afterWrite();
        return { content: [{ type: 'text', text: 'Tag updated.' }] };
      })
  );

  server.registerTool(
    'dripnex_get_changes',
    {
      description: 'Poll the local change log (GET /api/_changes?since=).',
      inputSchema: {
        since: z.number().default(0).describe('Return records with seq greater than this'),
      },
    },
    async ({ since }) =>
      runTool(async () => {
        const changes = await store.getChanges(since);
        const lines = changes.results.map(r => {
          const deleted = r.deleted ? ' deleted' : '';
          return `- seq ${r.seq}: ${r.kind} ${r.id}${deleted}`;
        });
        const text =
          lines.length > 0
            ? `last_seq: ${changes.last_seq}\n${lines.join('\n')}`
            : `last_seq: ${changes.last_seq}\nNo changes.`;
        return { content: [{ type: 'text', text }] };
      })
  );

  server.registerTool(
    'dripnex_trash_note',
    {
      description:
        'Move a note to trash (soft delete via DELETE /api/notes/:id). Pass permanent to hard-delete (?permanent=1).',
      inputSchema: {
        id: z.string().describe('Note ID'),
        permanent: z
          .boolean()
          .optional()
          .describe('Permanently delete instead of trashing (Local HTTP ?permanent=1)'),
      },
    },
    async ({ id, permanent }) =>
      runTool(async () => {
        if (!allowWrites()) return denyWrites();

        const ok = await store.trashNote(id, permanent === true);
        if (!ok) {
          return { content: [{ type: 'text', text: 'Note not found.' }] };
        }
        afterWrite();
        return {
          content: [
            {
              type: 'text',
              text: permanent ? 'Note permanently deleted.' : 'Note moved to trash.',
            },
          ],
        };
      })
  );

  return server;
}

function formatNoteList(notes: NoteListRow[]): string {
  if (notes.length === 0) return 'No notes found.';
  return notes
    .map(n => {
      if (n.word_count != null) {
        return `- **${n.title}** (${n.word_count} words)\n  ID: ${n.id}\n  Notebook: ${n.notebook_name || 'Inbox'} | Status: ${n.status}${n.is_pinned ? ' | Pinned' : ''}\n  Updated: ${n.updated_at}`;
      }
      const excerpt = n.excerpt ? `\n  ${n.excerpt}` : '';
      return `- **${n.title}**\n  ID: ${n.id}\n  Updated: ${n.updated_at}${excerpt}`;
    })
    .join('\n\n');
}

async function main() {
  const httpConfig = resolveLocalHttpConfig();
  const transport = new StdioServerTransport();

  if (httpConfig) {
    const client = new LocalHttpClient(httpConfig);
    const dbPath = tryResolveDbPath();
    const server = createServer(null, { http: client, dbPath });
    await server.connect(transport);
    return;
  }

  const dbPath = resolveDbPath();
  const db = openDb(dbPath);
  const server = createServer(db, { dbPath });
  await server.connect(transport);
}

main().catch(err => {
  console.error('MCP server error:', err);
  process.exit(1);
});

export { LocalHttpClient, resolveLocalHttpConfig } from './http.js';
