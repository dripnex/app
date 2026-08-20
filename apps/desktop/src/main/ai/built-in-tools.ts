// apps/desktop/src/main/ai/built-in-tools.ts
import type { ToolRegistry } from '@dripnex/ai-core';

/**
 * Register built-in AI tools for note operations.
 *
 * Read tools (auto-execute): search_notes, read_note, list_notebooks
 * Write tools (require confirmation): create_note, insert_text, replace_selection
 *
 * insert_text and replace_selection execute in the renderer (they need editor access).
 * They delegate via IPC: main → renderer → main.
 */
export function registerBuiltInTools(
  registry: ToolRegistry,
  deps: {
    searchNotes: (
      query: string,
      limit?: number
    ) => Promise<Array<{ id: string; title: string; snippet: string }>>;
    readNote: (id: string) => Promise<{ id: string; title: string; content: string } | null>;
    listNotebooks: () => Promise<Array<{ id: string; name: string; noteCount: number }>>;
    createNote: (title: string, content: string, notebookId?: string) => Promise<{ id: string }>;
  }
): void {
  registry.register({
    name: 'search_notes',
    description:
      'Search notes by keyword, plus meaning when the local index has embeddings. Returns matching note IDs, titles, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
    requiresConfirmation: false,
    execute: async args => {
      const results = await deps.searchNotes(args.query as string, (args.limit as number) ?? 10);
      return { ok: true, content: JSON.stringify(results) };
    },
  });

  registry.register({
    name: 'read_note',
    description: 'Read the full content of a note by its ID.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Note ID' },
      },
      required: ['id'],
    },
    requiresConfirmation: false,
    execute: async args => {
      const note = await deps.readNote(args.id as string);
      if (!note) return { ok: false, content: 'Note not found', error: 'Note not found' };
      return { ok: true, content: JSON.stringify(note) };
    },
  });

  registry.register({
    name: 'list_notebooks',
    description: 'List all notebooks with their names and note counts.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    execute: async () => {
      const notebooks = await deps.listNotebooks();
      return { ok: true, content: JSON.stringify(notebooks) };
    },
  });

  registry.register({
    name: 'create_note',
    description: 'Create a new note in a notebook.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content in markdown' },
        notebookId: {
          type: 'string',
          description: 'Target notebook ID (optional, uses default)',
        },
      },
      required: ['title', 'content'],
    },
    requiresConfirmation: true,
    execute: async args => {
      const result = await deps.createNote(
        args.title as string,
        args.content as string,
        args.notebookId as string | undefined
      );
      return { ok: true, content: JSON.stringify(result) };
    },
  });

  registry.register({
    name: 'insert_text',
    description: 'Insert text into the current note at the cursor position or at the end.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to insert' },
        position: {
          type: 'string',
          description: "Where to insert: 'cursor' (default) or 'end'",
        },
      },
      required: ['text'],
    },
    requiresConfirmation: true,
    rendererOnly: true,
    execute: async () => {
      // Execution handled by ipc-ai.ts via executeToolInRenderer
      return { ok: false, content: 'Not reachable', error: 'Renderer tool called without IPC' };
    },
  });

  registry.register({
    name: 'replace_selection',
    description: 'Replace the currently selected text in the editor.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Replacement text' },
      },
      required: ['text'],
    },
    requiresConfirmation: true,
    rendererOnly: true,
    execute: async () => {
      // Execution handled by ipc-ai.ts via executeToolInRenderer
      return { ok: false, content: 'Not reachable', error: 'Renderer tool called without IPC' };
    },
  });
}
