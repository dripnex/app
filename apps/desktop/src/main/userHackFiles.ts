/** User-editable files that make the desktop hackable, Inkdrop-style. */

import { join } from 'path';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { shell } from 'electron';

export const USER_INIT_FILE = 'init.js';
export const USER_STYLES_FILE = 'styles.css';
export const USER_KEYMAP_FILE = 'keybindings.json';

export type UserHackKind = 'init' | 'styles' | 'keymap';

export const INIT_JS_TEMPLATE = `// Dripnex init.js — runs on load. Save this file to apply.
// Paste as Link is already a built-in (Plugins menu / Mod+Shift+K).

dripnex.menu.add({
  label: 'Insert Date',
  accelerator: 'Mod+Shift+D',
  click: () => {
    dripnex.editor.insertAtCursor(new Date().toISOString().slice(0, 10));
    return true;
  },
});

// Vim (enable the Vim plugin first). Same surface as Inkdrop:
// const Vim = dripnex.vim
// if (Vim) {
//   Vim.map('jj', '<Esc>', 'insert')
//   Vim.map('Y', 'y$')
//   Vim.defineEx('find', 'f', () => {
//     void dripnex.commands.dispatch('app:focus-search')
//   })
// }
`;

export const STYLES_CSS_TEMPLATE = `/* Dripnex user stylesheet
 *
 * Override any UI. Tokens live on :root. Enable Development Mode
 * in Settings → General, then right-click → Inspect Element.
 * Save this file to apply.
 *
 * Surfaces:  --bg-base  --bg-surface  --bg-elevated  --bg-hover
 * Text:      --text-primary  --text-secondary  --text-muted
 * Accent:    --accent  --accent-muted
 * Borders:   --border  --border-subtle
 *
 * Motion (no JS library). Durations:
 *   --transition-fast  --transition-normal  --transition-slow
 * Settings → Plugins → Motion scales those. Or override here:
 *
 * :root {
 *   --accent: #f59e0b;
 *   --transition-normal: 280ms cubic-bezier(0.22, 1, 0.36, 1);
 * }
 *
 * @keyframes dripnex-fade {
 *   from { opacity: 0; }
 *   to { opacity: 1; }
 * }
 * .app__sidebar { animation: dripnex-fade 200ms ease; }
 *
 * .note-list-item[data-selected="true"] {
 *   background: color-mix(in srgb, var(--accent) 18%, transparent);
 * }
 *
 * Per-notebook text annotations (Inkdrop). Right-click a notebook →
 * Copy style selector. GFM stays **bold** / _italic_; only this book
 * restyles them. Preview uses strong/em; the editor uses .cm-strong/.cm-em.
 *
 * [data-notebook-id="inbox"] strong,
 * [data-notebook-id="inbox"] em,
 * [data-notebook-id="inbox"] .cm-strong,
 * [data-notebook-id="inbox"] .cm-em {
 *   font-size: 1.05em;
 *   text-decoration: underline;
 *   text-underline-position: under;
 *   background: color-mix(in srgb, var(--warning, #fbbf24) 18%, transparent);
 * }
 */
`;

export const KEYBINDINGS_TEMPLATE = `{
  // command id → chord. null unbinds the default.
  // Contexts: editor (CodeMirror), note-list (j/k next/prev note), app, global.
  // note-list chords do not fire when the editor is focused.
  // Save this file to apply. Open from Plugins → Open Keymap.

  // "app:next-note": "j",
  // "app:prev-note": "k",
  // "app:toggle-graph": "Mod+Shift+G",
  // "app:new-note": null,
  // "plugin:dripnex-paste-as-link:menu-paste-as-link": "Mod+Shift+L"
}
`;

function templateFor(kind: UserHackKind): string {
  if (kind === 'init') return INIT_JS_TEMPLATE;
  if (kind === 'styles') return STYLES_CSS_TEMPLATE;
  return KEYBINDINGS_TEMPLATE;
}

function fileFor(kind: UserHackKind): string {
  if (kind === 'init') return USER_INIT_FILE;
  if (kind === 'styles') return USER_STYLES_FILE;
  return USER_KEYMAP_FILE;
}

export async function openUserHackFile(
  dataRoot: string,
  kind: UserHackKind
): Promise<{ success: boolean; path?: string; error?: string }> {
  const filePath = join(dataRoot, fileFor(kind));
  if (!existsSync(filePath)) {
    await writeFile(filePath, templateFor(kind), 'utf-8');
  }
  const error = await shell.openPath(filePath);
  if (error) return { success: false, error };
  return { success: true, path: filePath };
}

/** Create init.js / styles.css on first launch if the user has none. */
export async function ensureUserHackFiles(dataRoot: string): Promise<void> {
  const files: Array<{ name: string; body: string }> = [
    { name: USER_INIT_FILE, body: INIT_JS_TEMPLATE },
    { name: USER_STYLES_FILE, body: STYLES_CSS_TEMPLATE },
    { name: USER_KEYMAP_FILE, body: KEYBINDINGS_TEMPLATE },
  ];
  for (const file of files) {
    const path = join(dataRoot, file.name);
    if (!existsSync(path)) {
      await writeFile(path, file.body, 'utf-8');
    }
  }
}
