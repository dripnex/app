# Plugin Ecosystem & Product Polish — Design Document

**Date:** 2026-02-19
**Scope:** Q1 2026 roadmap — plugin marketplace, developer experience, feature polish
**Timeline:** ~12 weeks (4 phases)

---

## Context

Dripnex v0.7.0 shipped with a solid plugin API (7 extension points, config system, hot reload) but lacks discoverability, marketplace, and developer tooling. Key gaps:

- AI Assistant plugin is invisible in Settings (hardcoded list misses it)
- Web sharing button exists but backend is unimplemented
- Tables plugin listed in Settings but has zero code
- No plugin marketplace or browsing
- No plugin development documentation
- No OAuth for AI — manual API key paste only
- Settings UI is too basic for a "hackable editor" positioning

**Target:** Inkdrop-level hackability — focused extension points, curated marketplace, good developer experience.

---

## Phase 1: Fix & Polish (Week 1-2)

### 1.1 AI Plugin in Settings

**Problem:** `PluginsSection.tsx` has a hardcoded `BUILT_IN_PLUGINS` array that doesn't include `dripnex-ai-assistant`.

**Solution:** Refactor PluginsSection to query the PluginRegistry for active built-in plugins instead of hardcoding. This makes the system future-proof — any new built-in plugin automatically appears. The `configSchema` in `aiAssistant.tsx` already defines `apiKey`, `model`, and `maxContextNotes` — the auto-generated config UI will render once the plugin is visible.

**Immediate fix (before refactor):** Add `dripnex-ai-assistant` to the hardcoded list.

### 1.2 Web Sharing (Public Links)

**Architecture:**

```
Desktop: Share button → IPC share:create → Main process
  → POST api.dripnex.app/share { title, content }
  → Returns { slug, url }
  → Copy URL to clipboard + toast

Web: dripnex.app/shared?slug=xxx
  → GET api.dripnex.app/share/{slug}
  → Render markdown (page already exists in shared.astro)
```

**Backend:** Cloudflare Workers + KV storage.

**Data model:**

```json
{
  "slug": "a8f3k2",
  "title": "My Note",
  "content": "# Markdown content...",
  "createdAt": "2026-02-19T...",
  "expiresAt": null
}
```

**IPC handlers needed in main/index.ts:**

- `share:create(input)` — POST to API, return `{ success, url, slug }`
- `share:delete(slug)` — DELETE from API

### 1.3 Tables Plugin

Implement as a proper built-in plugin using existing extension points:

- **Command:** "Insert Table" in command palette — creates markdown table template
- **CodeMirror extension:** Tab-to-next-cell, auto-alignment assistance
- **Preview:** WYSIWYG table rendering (already handled by `remarkGfm`, but enhance with sortable columns)
- **Code block renderer (optional):** `csv` language fence block renders as table

### 1.4 Settings UI Overhaul

**Current:** Basic cards with toggle/uninstall. Flat layout.

**Target:** Left sidebar with sections (already exists), but the Plugins section redesigned:

- **Tabs:** Installed | Browse (P2) | Updates (P4)
- **Plugin cards:** Icon, name, version, description, toggle, "Configure" expander
- **Config panel:** Inline accordion with schema-driven form (already works, just needs better visual treatment)
- **Visual quality:** Match Inkdrop's clean, spacious settings aesthetic

---

## Phase 2: Plugin Marketplace (Week 3-6)

### 2.1 Plugin Registry Backend

**Stack:** Cloudflare Workers + D1 (SQLite) + R2 (plugin bundles)

**Schema:**

```sql
CREATE TABLE plugins (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  author TEXT NOT NULL,
  version TEXT NOT NULL,
  readme TEXT,
  downloads INTEGER DEFAULT 0,
  stars REAL DEFAULT 0,
  category TEXT,
  tags TEXT, -- JSON array
  icon_url TEXT,
  bundle_url TEXT NOT NULL,
  min_api_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE plugin_versions (
  id INTEGER PRIMARY KEY,
  plugin_id TEXT REFERENCES plugins(id),
  version TEXT NOT NULL,
  changelog TEXT,
  bundle_url TEXT NOT NULL,
  min_api_version TEXT,
  created_at TEXT NOT NULL
);
```

**API endpoints:**

| Method | Path                      | Description                              |
| ------ | ------------------------- | ---------------------------------------- |
| GET    | `/plugins`                | List/search (pagination, category, sort) |
| GET    | `/plugins/:slug`          | Plugin detail                            |
| GET    | `/plugins/:slug/versions` | Version history                          |
| GET    | `/plugins/:slug/download` | Download bundle                          |
| POST   | `/plugins`                | Publish (auth required)                  |

### 2.2 Web Marketplace (dripnex.app/plugins)

New page on the Astro marketing site:

- Hero: "Extend Dripnex" + search bar
- Category filters: Themes, Editor, Productivity, Export, AI
- Card grid: icon, name, author, description, downloads, stars
- Detail page: README, screenshots, install button, version history
- Deep link: `dripnex://install-plugin/{slug}`

### 2.3 In-App Plugin Browser

New tabs in Settings > Plugins:

**Installed tab:**

- All active plugins (built-in + community)
- Toggle enable/disable
- Configure button (expands config form)
- Uninstall button (community only)

**Browse tab:**

- Fetches plugin list from registry API
- Search + category filter
- One-click "Install" button
- Plugin cards match web marketplace style

**Install flow:**

1. Click Install → download `.tar.gz` from registry
2. Extract to `~/.dripnex/plugins/<plugin-id>/`
3. Validate manifest
4. Hot-reload plugin system
5. Toast: "Installed! Configure now?"

### 2.4 Seed Plugins

Built by us to populate the marketplace:

| Plugin          | Category     | Extension Points Used                   |
| --------------- | ------------ | --------------------------------------- |
| `vim-mode`      | Editor       | `registerExtensions()` (CodeMirror vim) |
| `material-dark` | Theme        | `registerCssVariables()`                |
| `nord-theme`    | Theme        | `registerCssVariables()`                |
| `export-pdf`    | Export       | Command + Electron `printToPDF`         |
| `focus-mode`    | Productivity | Editor extensions (decorations)         |

---

## Phase 3: Developer Experience (Week 7-9)

### 3.1 Plugin API Documentation

**Location:** `apps/docs-site/` (VitePress)

**New sections:**

- **Getting Started** — Create your first plugin in 5 minutes
- **API Reference** — Every method in `PluginContext`, generated from TypeScript types
- **Extension Points Guide** — One page per zone/hook with working examples
- **Cookbook** — Common patterns:
  - "Add a status bar widget"
  - "Custom code block renderer"
  - "Theme plugin"
  - "Editor keybinding"
  - "Sidebar section"
- **Publishing Guide** — How to bundle, validate, and publish to the registry

### 3.2 Plugin CLI Improvements

Expand `dripnex-plugin` CLI:

```bash
dripnex-plugin init "My Plugin"    # Scaffold (exists)
dripnex-plugin dev                 # Watch + symlink to ~/.dripnex/plugins/
dripnex-plugin build               # Bundle to .tar.gz
dripnex-plugin publish             # Upload to registry (API key auth)
dripnex-plugin validate            # Check manifest, bundle size, API compat
```

### 3.3 Example Plugins Repository

`dripnex-example-plugins` repo with one example per extension point:

- `hello-world` — Command + toast
- `custom-preview` — Rehype plugin + component
- `editor-extension` — CodeMirror decoration
- `theme-plugin` — CSS variables
- `sidebar-widget` — Layout zone
- `code-block-renderer` — Mermaid/KaTeX style

### 3.4 Plugin Permissions System

Declared in `manifest.json`:

```json
{
  "permissions": ["editor:read", "editor:write", "app:read"]
}
```

**Permission levels:**

- `editor:read` — Read note content, selection, metadata
- `editor:write` — Modify note content, insert text
- `app:read` — Search/list notes, get current note
- `network` — Make HTTP requests
- `theme` — Override CSS variables

Shown to user at install time. Built-in plugins auto-granted all permissions.

---

## Phase 4: Advanced Features (Week 10-12)

### 4.1 Anthropic OAuth ("Connect with Claude")

**Preferred flow:**

1. User clicks "Connect with Claude" in AI plugin settings
2. Opens Anthropic OAuth consent page in system browser
3. User authorizes Dripnex
4. Callback returns access token
5. Token stored via `safeStorage.encryptString()`
6. AI assistant uses token — no manual API key needed

**Fallback (if OAuth not available):**

- "Get API Key" button → direct link to console.anthropic.com/settings/keys
- Paste key → instant validation (test API call with `claude-haiku-4-5`)
- Key encrypted via `safeStorage`
- Clear visual feedback: connected/disconnected state

### 4.2 Plugin Ratings & Reviews

- Dripnex account required to rate
- 1-5 star rating + optional text review
- Displayed on marketplace detail page and in-app browser
- Sort options: Popular, Recent, Highest Rated, Most Downloaded

### 4.3 Plugin Auto-Updates

- On app launch: check registry for newer versions of installed plugins
- Badge on Settings > Plugins tab when updates available
- "Update All" button + individual update buttons
- Changelog shown before applying update
- Rollback support (keep previous version .tar.gz)

### 4.4 Community Plugin Targets

Goal: 10+ plugins in registry by end of quarter:

| Plugin           | Builder      | Category     |
| ---------------- | ------------ | ------------ |
| vim-mode         | Us           | Editor       |
| material-dark    | Us           | Theme        |
| nord-theme       | Us           | Theme        |
| export-pdf       | Us           | Export       |
| focus-mode       | Us           | Productivity |
| mermaid-diagrams | Us/Community | Preview      |
| katex-math       | Us/Community | Preview      |
| reading-time     | Community    | Productivity |
| todo-highlights  | Community    | Editor       |
| zen-mode         | Community    | Productivity |

---

## Architecture Decisions

### Plugin API Level: Inkdrop-level

- Focused extension points, not full DOM/internal access
- Curated zones for UI components
- Schema-driven config with auto-UI
- No direct Electron API access from plugins

### Registry: Centralized (dripnex.app)

- Full control over quality and security
- One-click install from desktop app
- Deep links from web marketplace
- Future: automated security scanning

### Plugin Format: CommonJS bundle (.tar.gz)

- manifest.json + index.js + assets
- Evaluated in renderer process
- No Node.js access (renderer-only)
- Hot-reloadable

### Storage: Filesystem + SQLite

- Plugin files in `~/.dripnex/plugins/`
- Config in SQLite `plugin_config` table
- Registry state in SQLite `plugin_registry` table

---

## Success Criteria

- [ ] AI plugin configurable in Settings (P1)
- [ ] Web sharing works end-to-end (P1)
- [ ] Tables plugin functional (P1)
- [ ] Settings UI matches Inkdrop quality (P1)
- [ ] Plugin registry API deployed (P2)
- [ ] dripnex.app/plugins live (P2)
- [ ] In-app browse and install works (P2)
- [ ] 5 seed plugins published (P2)
- [ ] Plugin dev docs on docs site (P3)
- [ ] CLI build/publish commands work (P3)
- [ ] Example plugins repo exists (P3)
- [ ] OAuth or improved API key flow (P4)
- [ ] 10+ plugins in registry (P4)
- [ ] Auto-updates working (P4)
