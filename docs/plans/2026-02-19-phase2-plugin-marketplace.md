# Phase 2: Plugin Marketplace — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the plugin marketplace — backend API, expanded web catalog, in-app plugin browser, and seed plugins to populate the marketplace.

**Architecture:** Plugin catalog stored in Turso (libSQL) via Drizzle ORM, served by Hono API routes on Cloudflare Workers. Marketing site (Astro) renders the web-facing catalog. Desktop app fetches from the API in the Browse tab. Seed plugins demonstrate the plugin system and give users something to install.

**Tech Stack:** Hono, Drizzle ORM, Turso/libSQL, Zod, Astro 5, React, TypeScript, Electron IPC

---

### Task 1: Add Plugin Catalog Schema to Database

**Files:**

- Modify: `packages/api/src/db/schema.ts`

**Step 1: Add `pluginCatalog` table**

After `sharedNotes`, add:

```typescript
/**
 * Plugin catalog — published plugins in the marketplace
 */
export const pluginCatalog = sqliteTable(
  'plugin_catalog',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    readme: text('readme'),
    author: text('author').notNull(),
    version: text('version').notNull(),
    category: text('category').notNull().default('other'),
    tags: text('tags').notNull().default('[]'), // JSON array
    icon: text('icon').notNull().default('puzzle'),
    repositoryUrl: text('repository_url'),
    bundleUrl: text('bundle_url'),
    downloads: integer('downloads').notNull().default(0),
    minApiVersion: text('min_api_version'),
    isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
    status: text('status').notNull().default('published'), // 'published' | 'draft' | 'rejected'
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => [
    index('idx_plugin_catalog_category').on(table.category),
    index('idx_plugin_catalog_status').on(table.status),
  ]
);
```

**Step 2: Add type exports**

```typescript
export type PluginCatalogEntry = typeof pluginCatalog.$inferSelect;
export type NewPluginCatalogEntry = typeof pluginCatalog.$inferInsert;
```

**Step 3: Run typecheck**

Run: `pnpm --filter @readied/api typecheck`
Expected: passes

**Step 4: Commit**

```bash
git add packages/api/src/db/schema.ts
git commit -m "feat(api): add plugin catalog database schema"
```

---

### Task 2: Create Plugin Catalog API Routes

**Files:**

- Create: `packages/api/src/routes/plugins.ts`
- Modify: `packages/api/src/index.ts` (mount route)

**Step 1: Create the routes file**

`packages/api/src/routes/plugins.ts` with these endpoints:

- `GET /` — List plugins (public, filterable by category, search, sort)
- `GET /:slug` — Get single plugin detail (public)

Follows the same pattern as `share.ts`:

- Uses Hono router
- Uses Zod for query validation
- Uses `createDb(c.env)` for database access
- No auth required for read-only catalog endpoints

**Step 2: Mount in index.ts**

```typescript
import { plugins } from './routes/plugins.js';
app.route('/plugins', plugins);
```

**Step 3: Run typecheck**

Run: `pnpm --filter @readied/api typecheck`
Expected: passes

**Step 4: Commit**

```bash
git add packages/api/src/routes/plugins.ts packages/api/src/index.ts
git commit -m "feat(api): add plugin catalog API routes (list, get, search)"
```

---

### Task 3: Expand Marketing Site Plugin Catalog

**Files:**

- Modify: `apps/marketing-site/src/data/plugins.json` (add all built-in + seed plugins)
- Modify: `apps/marketing-site/src/components/PluginFilter.tsx` (add search + sorting)

**Step 1: Expand plugins.json with all plugins**

Add entries for all built-in plugins + upcoming seed plugins:

- readied-ai-assistant (existing)
- readied-word-count (existing)
- readied-typewriter-mode (new entry)
- readied-active-line-highlight (new entry)
- readied-tables (new entry)
- readied-focus-mode (seed: community)
- readied-reading-time (seed: community)
- readied-export-markdown (seed: community)

Each entry includes: id, name, description, author, version, category, icon, builtin, tags, downloads (number)

**Step 2: Add search input to PluginFilter**

Add a search input above the category filters that filters by name, description, and tags.

**Step 3: Add sort dropdown**

Add a sort selector: Popular (downloads), Newest, A-Z.

**Step 4: Add download count badge to cards**

Show download count on each card.

**Step 5: Verify**

Run: `pnpm --filter @readied/marketing-site build`
Expected: builds successfully

**Step 6: Commit**

```bash
git add apps/marketing-site/src/data/plugins.json \
  apps/marketing-site/src/components/PluginFilter.tsx
git commit -m "feat(marketing): expand plugin catalog with search, sorting, and seed plugins"
```

---

### Task 4: Implement Desktop In-App Plugin Browser

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx`
- Modify: `apps/desktop/src/renderer/pages/settings/sections/Section.module.css`

**Step 1: Create marketplace data type and static catalog**

For now, embed the same plugin catalog data statically (later this fetches from API). Define a `MarketplacePlugin` interface and a `MARKETPLACE_PLUGINS` array.

**Step 2: Replace Browse tab placeholder**

Replace the "Coming soon" placeholder with:

- Search input
- Category filter pills
- Plugin card grid showing marketplace plugins
- Each card has: icon, name, author, description, version, category badge, download count
- "Install" button (disabled with tooltip "Coming soon" for community plugins)
- Built-in plugins show "Included" badge instead of install button

**Step 3: Add CSS for marketplace cards**

Add styles for `.pluginMarketplaceGrid`, `.pluginMarketplaceCard`, category pills, and install button.

**Step 4: Verify**

Run: `pnpm --filter @readied/desktop typecheck`
Expected: passes

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx \
  apps/desktop/src/renderer/pages/settings/sections/Section.module.css
git commit -m "feat(settings): implement in-app plugin marketplace browser"
```

---

### Task 5: Create Seed Plugins — Focus Mode

**Files:**

- Create: `apps/desktop/src/renderer/plugins/focusMode.ts`
- Modify: `apps/desktop/src/renderer/plugins/index.ts`

**Step 1: Create the focus mode plugin**

Focus mode dims all paragraphs except the one the cursor is in. Uses `context.decorations.addLineHighlight()` on non-active paragraphs with a dim class, or uses editor extensions for line decorations.

Simpler approach: registers a command "Toggle Focus Mode" that adds a CSS class to the editor container, and uses a CodeMirror extension to dim non-active lines.

**Step 2: Register in plugins/index.ts**

Add to builtInPlugins array.

**Step 3: Verify**

Run: `pnpm --filter @readied/desktop typecheck`
Expected: passes

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/plugins/focusMode.ts \
  apps/desktop/src/renderer/plugins/index.ts
git commit -m "feat(plugins): add focus mode plugin (dims non-active paragraphs)"
```

---

### Task 6: Create Seed Plugins — Reading Time

**Files:**

- Create: `apps/desktop/src/renderer/plugins/readingTime.ts`
- Modify: `apps/desktop/src/renderer/plugins/index.ts`

**Step 1: Create the reading time plugin**

Registers a status bar component (using `editor-header-actions` zone or `status-bar` zone) that shows estimated reading time based on word count (~200 WPM).

Uses `context.editor.onContentChanged()` to recalculate, and `context.layout.addComponent('status-bar', ...)` to render.

**Step 2: Register in plugins/index.ts**

**Step 3: Verify and commit**

```bash
git add apps/desktop/src/renderer/plugins/readingTime.ts \
  apps/desktop/src/renderer/plugins/index.ts
git commit -m "feat(plugins): add reading time plugin (estimated read time in status bar)"
```

---

### Task 7: Create Seed Plugins — Export Markdown

**Files:**

- Create: `apps/desktop/src/renderer/plugins/exportMarkdown.ts`
- Modify: `apps/desktop/src/renderer/plugins/index.ts`

**Step 1: Create the export markdown plugin**

Registers a command "Copy as Markdown" that copies the current note's raw markdown content to the clipboard with a toast notification.

Also registers "Copy as HTML" that renders the markdown to HTML using the existing remark pipeline and copies to clipboard.

Uses `context.editor.getContent()` and `context.app.getCurrentNote()`.

**Step 2: Register in plugins/index.ts**

**Step 3: Verify and commit**

```bash
git add apps/desktop/src/renderer/plugins/exportMarkdown.ts \
  apps/desktop/src/renderer/plugins/index.ts
git commit -m "feat(plugins): add export markdown plugin (copy as markdown/HTML)"
```

---

### Task 8: Final Verification

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: All projects pass

**Step 2: Full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Production build**

Run: `pnpm build`
Expected: All projects build

**Step 4: Manual verification checklist**

- [ ] Settings > Plugins > Browse tab shows plugin marketplace grid
- [ ] Marketplace has search and category filters
- [ ] All built-in plugins appear in Installed tab
- [ ] Focus Mode plugin works (Toggle Focus Mode command)
- [ ] Reading Time shows in status bar
- [ ] Export Markdown commands work (Copy as Markdown, Copy as HTML)
- [ ] Marketing site /plugins page shows expanded catalog with search
- [ ] API plugin routes typecheck correctly

**Step 5: Commit any fixes, then push**

```bash
git push -u origin feature/phase2-plugin-marketplace
gh pr create --base develop --title "feat: Phase 2 — plugin marketplace, seed plugins, in-app browser"
```
