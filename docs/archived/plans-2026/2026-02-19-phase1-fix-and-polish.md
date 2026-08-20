# Phase 1: Fix & Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the AI plugin visibility in Settings, implement web sharing, create the tables plugin, and overhaul the Settings plugin UI.

**Architecture:** All changes are in the desktop app (`apps/desktop/`). The AI fix is a straightforward addition to a hardcoded list + refactor to query runtime plugins. Web sharing requires a new Cloudflare Worker backend + IPC handler wiring. Tables plugin uses existing extension points. Settings UI is CSS/component work.

**Tech Stack:** React, TypeScript, Electron IPC, Cloudflare Workers, CodeMirror 6, CSS Modules

---

### Task 1: Add AI Assistant to Settings Built-in List

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx:38-64`

**Step 1: Add AI Assistant to BUILT_IN_PLUGINS array**

In `PluginsSection.tsx`, find the `BUILT_IN_PLUGINS` array (line 38) and add the AI assistant entry after the last item:

```typescript
  {
    id: 'dripnex-ai-assistant',
    name: 'AI Assistant',
    version: '0.1.0',
    description: 'AI assistant with RAG over your notes, powered by Claude',
  },
```

**Step 2: Verify in dev mode**

Run: `pnpm dev` from repo root
Open Settings > Plugins
Expected: AI Assistant card appears in the Built-in section with name, version, description

**Step 3: Verify config form renders**

Click "Configure" on the AI Assistant card.
Expected: Three config fields appear:

- API Key (text input)
- Model (dropdown: Claude Sonnet 4.5 / Claude Haiku 4.5)
- Max Context Notes (range slider 1-20)

The config form auto-generates from the `configSchema` in `aiAssistant.tsx:102-125`. The Settings UI fetches config via `window.dripnex.pluginConfig.getAll('dripnex-ai-assistant')`.

**Step 4: Test config persistence**

Enter a test API key, change model, adjust slider. Close Settings. Reopen.
Expected: Values persisted (stored in SQLite `plugin_config` table).

**Step 5: Remove Tables placeholder**

Remove the `dripnex-tables` entry from `BUILT_IN_PLUGINS` (it has no implementation). We'll add it back when the plugin is real (Task 4).

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx
git commit -m "fix(settings): add AI Assistant to built-in plugins list, remove tables placeholder"
```

---

### Task 2: Refactor PluginsSection to Query Runtime Plugins

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx`
- Modify: `apps/desktop/src/preload/index.ts` (add new IPC method)
- Modify: `apps/desktop/src/main/index.ts` (add IPC handler)

**Goal:** Instead of hardcoding built-in plugins in Settings, query the PluginHost for active built-in plugins at runtime. This way any new built-in plugin automatically appears in Settings.

**Step 1: Add IPC channel for querying built-in plugin manifests**

In `apps/desktop/src/main/index.ts`, add a new handler near the other plugin handlers (~line 1856):

```typescript
ipcMain.handle('plugins:getBuiltInManifests', async () => {
  // Built-in plugins are loaded in the renderer, not main process.
  // Return empty array — renderer will handle built-in discovery.
  return [];
});
```

Actually, since built-in plugins are loaded directly in the renderer (in `App.tsx`), the Settings page can query the PluginRegistry directly. No IPC needed.

**Step 2: Export built-in plugin manifests from a shared module**

Create `apps/desktop/src/renderer/plugins/index.ts`:

```typescript
export { wordCountPlugin } from './wordCount';
export { typewriterModePlugin } from './typewriterMode';
export { activeLineHighlightPlugin } from './activeLineHighlight';
export { aiAssistantPlugin } from './aiAssistant';

import { wordCountPlugin } from './wordCount';
import { typewriterModePlugin } from './typewriterMode';
import { activeLineHighlightPlugin } from './activeLineHighlight';
import { aiAssistantPlugin } from './aiAssistant';
import type { PluginManifest } from '@dripnex/plugin-api';

/** All built-in plugin manifests. Used by App.tsx and PluginsSection. */
export const builtInPlugins: PluginManifest[] = [
  wordCountPlugin,
  typewriterModePlugin,
  activeLineHighlightPlugin,
  aiAssistantPlugin,
];
```

**Step 3: Use shared module in App.tsx**

In `apps/desktop/src/renderer/App.tsx`, replace the inline `builtInPlugins` useMemo with the import:

```typescript
import { builtInPlugins } from './plugins';
```

Remove the old `useMemo(() => [wordCountPlugin, ...], [])`.

**Step 4: Use shared module in PluginsSection.tsx**

Replace the hardcoded `BUILT_IN_PLUGINS` array with:

```typescript
import { builtInPlugins } from '../../plugins';

// Derive built-in plugin info from actual manifests
const builtInPluginInfos: BuiltInPluginInfo[] = builtInPlugins.map(p => ({
  id: p.id,
  name: p.name,
  version: p.version,
  description: p.description ?? '',
}));
```

Then use `builtInPluginInfos` wherever `BUILT_IN_PLUGINS` was used.

**Step 5: Verify**

Run: `pnpm dev` — Settings > Plugins shows all 4 built-in plugins.
Run: `pnpm typecheck` — passes.

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/plugins/index.ts \
  apps/desktop/src/renderer/App.tsx \
  apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx
git commit -m "refactor(settings): derive built-in plugin list from runtime manifests"
```

---

### Task 3: Implement Web Sharing Backend + IPC

**Files:**

- Modify: `apps/desktop/src/main/handlers/shareHandlers.ts` (already exists, needs implementation)
- Modify: `apps/desktop/src/main/index.ts` (verify handler registration)
- Create: Cloudflare Worker for share API (separate repo or `packages/api/`)

**Step 1: Check existing share handler file**

Read `apps/desktop/src/main/handlers/shareHandlers.ts` — it likely has the structure but needs the actual HTTP calls implemented.

**Step 2: Implement share:create handler**

The handler should:

1. Generate a random slug (8 chars, alphanumeric)
2. POST to `https://api.dripnex.app/share` with `{ slug, title, content }`
3. Return `{ success: true, url: 'https://dripnex.app/shared?slug=xxx', slug }`
4. Copy URL to clipboard via Electron's `clipboard.writeText()`

```typescript
import { ipcMain, clipboard } from 'electron';
import crypto from 'crypto';

function generateSlug(): string {
  return crypto.randomBytes(4).toString('hex');
}

ipcMain.handle(
  'share:create',
  async (_event, input: { noteId: string; title: string; content: string }) => {
    try {
      const slug = generateSlug();
      const response = await fetch('https://api.dripnex.app/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title: input.title, content: input.content }),
      });

      if (!response.ok) {
        return { success: false, error: `API error: ${response.status}` };
      }

      const url = `https://dripnex.app/shared?slug=${slug}`;
      clipboard.writeText(url);
      return { success: true, url, slug };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
);
```

**Step 3: Implement share:delete handler**

```typescript
ipcMain.handle('share:delete', async (_event, slug: string) => {
  try {
    const response = await fetch(`https://api.dripnex.app/share/${slug}`, {
      method: 'DELETE',
    });
    return {
      success: response.ok,
      error: response.ok ? undefined : `API error: ${response.status}`,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
```

**Step 4: Deploy Cloudflare Worker**

Create a Cloudflare Worker with KV binding `SHARES`:

```typescript
// worker/src/index.ts
export default {
  async fetch(request: Request, env: { SHARES: KVNamespace }): Promise<Response> {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

    // POST /share — create
    if (request.method === 'POST' && url.pathname === '/share') {
      const body = (await request.json()) as { slug: string; title: string; content: string };
      await env.SHARES.put(
        body.slug,
        JSON.stringify({
          title: body.title,
          content: body.content,
          createdAt: new Date().toISOString(),
        }),
        { expirationTtl: 60 * 60 * 24 * 30 }
      ); // 30 days
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    // GET /share/:slug — read
    if (request.method === 'GET' && url.pathname.startsWith('/share/')) {
      const slug = url.pathname.split('/')[2];
      const data = await env.SHARES.get(slug);
      if (!data) return new Response('Not found', { status: 404, headers: cors });
      return new Response(data, { headers: cors });
    }

    // DELETE /share/:slug — delete
    if (request.method === 'DELETE' && url.pathname.startsWith('/share/')) {
      const slug = url.pathname.split('/')[2];
      await env.SHARES.delete(slug);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    return new Response('Not found', { status: 404 });
  },
};
```

**Step 5: Test end-to-end**

1. Open app in dev mode
2. Open a note with content
3. Click "..." actions > "Share on Web"
4. Expected: toast "Link copied to clipboard"
5. Open the URL in browser
6. Expected: note renders on dripnex.app/shared page

**Step 6: Commit**

```bash
git add apps/desktop/src/main/handlers/shareHandlers.ts
git commit -m "feat(share): implement web sharing IPC handlers"
```

---

### Task 4: Tables Plugin (Basic)

**Files:**

- Create: `apps/desktop/src/renderer/plugins/tables.tsx`
- Modify: `apps/desktop/src/renderer/plugins/index.ts` (add to builtInPlugins)

**Step 1: Create the tables plugin**

The plugin registers a command "Insert Table" that inserts a markdown table template at cursor:

```typescript
// apps/desktop/src/renderer/plugins/tables.tsx
import type { PluginManifest } from '@dripnex/plugin-api';

export const tablesPlugin: PluginManifest = {
  id: 'dripnex-tables',
  name: 'Tables',
  version: '1.0.0',
  description: 'Insert markdown tables with a command. Tables render in preview via GFM.',

  activate(context) {
    const unregisterInsert = context.registerCommand(
      {
        id: 'insert-table',
        name: 'Insert Table',
        keybinding: { key: 'T', modifiers: ['Mod', 'Shift'] },
        icon: 'Table',
      },
      () => {
        const template = [
          '| Column 1 | Column 2 | Column 3 |',
          '| -------- | -------- | -------- |',
          '| Cell 1   | Cell 2   | Cell 3   |',
          '| Cell 4   | Cell 5   | Cell 6   |',
          '',
        ].join('\n');
        context.editor.insertAtCursor(template);
        context.editor.focus();
        return true;
      }
    );

    return {
      dispose() {
        unregisterInsert();
      },
    };
  },
};
```

**Step 2: Register in plugins/index.ts**

Add to the imports and `builtInPlugins` array:

```typescript
import { tablesPlugin } from './tables';

export const builtInPlugins: PluginManifest[] = [
  wordCountPlugin,
  typewriterModePlugin,
  activeLineHighlightPlugin,
  aiAssistantPlugin,
  tablesPlugin,
];
```

**Step 3: Test**

Run: `pnpm dev`
Open Command Palette > "Insert Table"
Expected: Markdown table inserted at cursor. Preview shows formatted table.

Also verify Settings > Plugins shows "Tables" in built-in list (from Task 2 refactor).

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: passes

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/plugins/tables.tsx \
  apps/desktop/src/renderer/plugins/index.ts
git commit -m "feat(plugins): add tables plugin with insert table command"
```

---

### Task 5: Settings Plugins UI Overhaul

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx`
- Modify: `apps/desktop/src/renderer/pages/settings/sections/Section.module.css`

**Goal:** Add tabbed navigation (Installed / Browse), improve card design, better config UX.

**Step 1: Add tab navigation to PluginsSection**

Add a tab bar at the top of the plugin section:

```tsx
const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('installed');

// In the render:
<div className={styles.pluginTabs}>
  <button
    className={`${styles.pluginTab} ${activeTab === 'installed' ? styles.pluginTabActive : ''}`}
    onClick={() => setActiveTab('installed')}
  >
    Installed
  </button>
  <button
    className={`${styles.pluginTab} ${activeTab === 'browse' ? styles.pluginTabActive : ''}`}
    onClick={() => setActiveTab('browse')}
  >
    Browse
  </button>
</div>;
```

The "Browse" tab shows a placeholder message for now (marketplace comes in Phase 2).

**Step 2: Add tab CSS to Section.module.css**

```css
.pluginTabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--bg-elevated);
  border-radius: 8px;
  margin-bottom: 16px;
}

.pluginTab {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.pluginTab:hover {
  color: var(--text-secondary);
}

.pluginTabActive {
  background: var(--bg-base);
  color: var(--text-primary);
}
```

**Step 3: Improve plugin card design**

Update `.pluginCard` styles for better visual hierarchy:

- Add subtle left border accent for enabled plugins
- Better spacing between name/version/description
- Config section with smoother accordion animation
- "Enabled" badge uses accent color

**Step 4: Add search/filter to installed tab**

Add a search input that filters plugins by name/description:

```tsx
const [search, setSearch] = useState('');
const filteredBuiltIn = builtInPluginInfos.filter(
  p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
);
```

**Step 5: Add "Browse" tab placeholder**

```tsx
{
  activeTab === 'browse' && (
    <div className={styles.pluginBrowsePlaceholder}>
      <Puzzle size={48} />
      <h3>Plugin Marketplace</h3>
      <p>Browse and install community plugins. Coming soon.</p>
    </div>
  );
}
```

**Step 6: Verify**

Run: `pnpm dev` — Settings > Plugins
Expected: Tab bar, search, improved cards, Browse placeholder.

**Step 7: Commit**

```bash
git add apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx \
  apps/desktop/src/renderer/pages/settings/sections/Section.module.css
git commit -m "feat(settings): overhaul plugin section with tabs, search, and improved cards"
```

---

### Task 6: Final Verification

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: All 18+ projects pass

**Step 2: Full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Production build**

Run: `pnpm build`
Expected: All projects build successfully

**Step 4: Manual smoke test checklist**

- [ ] Settings > Plugins shows AI Assistant with config form
- [ ] AI config persists (API key, model, context notes)
- [ ] "Share on Web" creates link and copies to clipboard (requires backend)
- [ ] Command Palette > "Insert Table" inserts markdown table
- [ ] Tables render in preview (already works via remarkGfm)
- [ ] Plugin tabs work (Installed / Browse)
- [ ] Plugin search filters correctly
- [ ] Browse tab shows "Coming soon" placeholder

**Step 5: Create PR**

```bash
git push -u origin fix/phase1-fix-and-polish
gh pr create --base develop --title "feat(desktop): Phase 1 — fix AI settings, web sharing, tables, Settings UI" --body "..."
```
