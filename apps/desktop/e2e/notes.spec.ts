import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures.js';

/**
 * Notes CRUD end-to-end.
 *
 * We exercise the IPC contract directly through the preload bridge
 * (`window.readied.notes`) rather than driving the editor UI. This is
 * intentional:
 *   - The UI elements (selectors, labels, hotkeys) churn often. Asserting
 *     against the IPC surface gives us regression coverage on the
 *     *contract* that survives renderer refactors.
 *   - Anything that breaks here also breaks the desktop's renderer code,
 *     because the renderer uses the same bridge.
 */
test.describe('notes IPC contract', () => {
  test('create → list → read roundtrip', async () => {
    const { window, cleanup } = await launchApp();
    try {
      const noteId = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const content = '# E2E note\n\nbody from playwright';

      const createResult = await window.evaluate(
        async ([id, body]) => {
          const api = (
            window as unknown as {
              readied: {
                notes: {
                  create: (input: {
                    id?: string;
                    content: string;
                    notebookId?: string;
                  }) => Promise<unknown>;
                  list: (
                    opts?: Record<string, unknown>
                  ) => Promise<Array<{ id: string; title: string; content: string }>>;
                  get: (id: string) => Promise<unknown>;
                };
              };
            }
          ).readied;
          const created = await api.notes.create({ id, content: body });
          return { created };
        },
        [noteId, content] as const
      );

      expect(createResult.created).toBeTruthy();

      const list = await window.evaluate(
        async () =>
          (
            window as unknown as {
              readied: {
                notes: {
                  list: () => Promise<Array<{ id: string; title: string; content: string }>>;
                };
              };
            }
          ).readied.notes.list(),
        undefined
      );

      const ourNote = list.find(n => n.id === noteId);
      expect(ourNote, `note ${noteId} missing from list`).toBeDefined();
      expect(ourNote!.content).toContain('body from playwright');
    } finally {
      await cleanup();
    }
  });

  test('search returns the freshly-created note via FTS5', async () => {
    const { window, cleanup } = await launchApp();
    try {
      const marker = `marker_${Date.now()}_unique`;
      await window.evaluate(
        async ([body]) => {
          const api = (
            window as unknown as {
              readied: {
                notes: { create: (input: { content: string }) => Promise<unknown> };
              };
            }
          ).readied;
          await api.notes.create({ content: `# Searchable\n\n${body}` });
        },
        [marker] as const
      );

      const results = await window.evaluate(
        async ([q]) =>
          (
            window as unknown as {
              readied: {
                notes: {
                  search: (
                    query: string,
                    limit?: number
                  ) => Promise<Array<{ id: string; content: string }>>;
                };
              };
            }
          ).readied.notes.search(q, 10),
        [marker] as const
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.content.includes(marker))).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
