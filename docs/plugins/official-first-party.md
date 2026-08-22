# Official first-party plugins — research

Written 2026-08-22 against `develop` (`f155600`) plus live registry QA on [#547](https://github.com/dripnex/app/issues/547) and the packaged install bug [#562](https://github.com/dripnex/app/issues/562). Desktop only. No marketplace. No iOS.

This is a sourced inventory and a ranked list of **editor / GFM packs** we could build **after** vim / math / mermaid install-and-update actually works. It does not implement plugins.

---

## 1. How plugins install and load today

Two worlds share one `PluginHost`:

| Kind           | Where the code lives                 | How it gets on disk                   | How it activates                                                                                        |
| -------------- | ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Built-in**   | `apps/desktop/src/renderer/plugins/` | Shipped in the app bundle             | `builtInPlugins` in `plugins/index.ts` → `usePluginRuntime` filters `plugin_registry.enabled !== false` |
| **Discovered** | User-data `plugins/<manifest.id>/`   | CLI, Settings Install, or file-picker | Main `scanPlugins()` → renderer `loadPluginFromSource()` → same `PluginHost`                            |

There is no packaged `extraResources` plugin tree (confirmed in [#547](https://github.com/dripnex/app/issues/547) QA). Community / first-party packs are always user-data.

### 1.1 plugin-api surface (what a pack can hook)

Package: `packages/plugin-api`. Current major: `PLUGIN_API_VERSION = "1"` (`src/apiVersion.ts`).

A pack is a pre-bundled CommonJS module (`module.exports = { id, name, version, activate }`). The renderer evaluates it with `new Function` in `src/loader/loadPluginFromSource.ts`. Host `require()` is a whitelist (`apps/desktop/src/renderer/plugins/pluginRequire.ts`):

- `react`, `react-dom`, `react/jsx-runtime`
- `@codemirror/state`, `view`, `language`, `commands`, `search`
- `@dripnex/plugin-api`

Anything else (including `@replit/codemirror-vim`) must be bundled into `index.js`.

`PluginContext` (`packages/plugin-api/src/types.ts`) — editor / GFM-relevant hooks:

| Hook                                                                       | Use                                                                    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `editor`                                                                   | `getContent`, `insertAtCursor`, `replaceRange`, `getView()` (live CM6) |
| `registerExtensions(id, Extension[])`                                      | CM6 compartment — keymaps, widgets, decorations                        |
| `decorations`                                                              | `addLineHighlight`, `addWidget`, `clear`                               |
| `registerCommand` / `dispatchCommand`                                      | Palette + keybindings (`plugin:{id}:{cmd}`)                            |
| `registerRemarkPlugin` / `registerRehypePlugin`                            | Preview pipeline (appends after core)                                  |
| `registerPreviewComponent(tag, React)`                                     | Replace a preview HTML tag (`table`, …)                                |
| `registerCodeBlockRenderer(lang, React)`                                   | Fence languages (`mermaid`, `math`, `latex`)                           |
| `registerVim(api)`                                                         | Publish `dripnex.vim` for `init.js`                                    |
| `layout.addComponent(zone, …)`                                             | 9 zones, including `editor-status-bar`, `modal`                        |
| `menu.add` / `contextMenu.add`                                             | Plugins menu + editor/note-list context                                |
| `config`                                                                   | SQLite `plugin_config`, sync get / async set                           |
| `markdownRenderer`                                                         | Inkdrop-shaped remark/rehype/React/fence maps                          |
| `clipboard`, `notifications`, `preview.on('a:click' \| 'checkbox:change')` | I/O + preview events                                                   |

Declarative package files (optional, applied after `activate`): `keymaps/*.json`, `menus/*.json`, `styles/*.css`, `theme.json` / `themes/*.json`. Parsed in `packages/plugin-api/src/packageFiles/`.

Hackable user files (not packs): `init.js`, `styles.css`, `keybindings.json` in the data dir. Documented in `docs/PLUGIN_SYSTEM.md`.

### 1.2 Scanner and runtime

```
userData/plugins/<id>/
  manifest.json     # id, name, version, main?, configSchema?
  <main>            # usually dist/index.js
  keymaps/ menus/ styles/ themes/   # optional
```

- Main reads the tree: `apps/desktop/src/main/pluginScanner.ts`.
- Skips a folder unless `manifest.main` exists **or** it is theme-only (`theme.json` / `themes/`).
- Enable/disable: SQLite `plugin_registry`. **No row = enabled.**
- Renderer: `pluginRuntimeStore` (`apps/desktop/src/renderer/stores/pluginRuntimeStore.ts`) scans, evals, loads `init.js` as plugin `user-init`.
- `usePluginRuntime` concatenates enabled built-ins + discovered manifests into one `PluginHost`.
- Reload: `plugins:requestReload` IPC + `pluginWatcher.ts` (watches the plugins dir and user hack files).

Desktop userData is `createDataPaths(app.getPath('userData'))` in `apps/desktop/src/main/index.ts`. Packaged `productName` is `Dripnex` (`apps/desktop/package.json`), so the plugins dir is:

| OS      | Packaged desktop                                |
| ------- | ----------------------------------------------- |
| macOS   | `~/Library/Application Support/Dripnex/plugins` |
| Linux   | `~/.config/Dripnex/plugins`                     |
| Windows | `%APPDATA%/Dripnex/plugins`                     |

### 1.3 Install path (three doors, one unpack)

All three write the same folder: `plugins/<manifest.id>/`.

1. **Settings → Plugins → Install** (`BrowseTab.tsx`)
   - Fetches `GET /plugins` (`plugins:listRegistry`).
   - If the registry returns any rows, **the fallback catalog is replaced**.
   - Install click calls `installFromSpec(plugin.slug)` — a kebab slug, not `owner/repo`.
   - “Other package” text field accepts `stamp`, `owner/repo`, or `owner/repo@tag`.
2. **CLI** `dripnex-plugin install <spec>` (`packages/plugin-cli/src/commands/install.ts`)
   - Spec parser: local path, HTTPS archive, `owner/repo[@tag]`, or registry slug (`installSpec.ts`).
   - GitHub: latest (or tagged) release, first `.tar.gz` / `.tgz` asset.
   - Registry: `GET {api}/plugins/:slug` → `bundleUrl`.
   - **Refuses if `<manifest.id>` is already installed.** No `update` command.
3. **File picker** `plugins:install` — local `.tar.gz` / `.zip`. Desktop overwrite **is** allowed (rm + rename).

Desktop `installFromSpec` (`githubInstall.ts` + `pluginHandlers.ts`) resolves GitHub or registry, then `installPluginFromHttpsUrl`. HTTPS hosts are allow-listed (GitHub + `api.dripnex.app` + `*.workers.dev`).

### 1.4 Update path

Settings → Plugins → Updates (`UpdatesTab.tsx`):

1. `scan()` local packs.
2. `listRegistry()`.
3. Match **`scan().id === registry.slug`**.
4. If `versionNewer(remote, local)`, show Update.
5. Update = `installFromSpec(remote.slug)` (desktop overwrite).

Built-ins never appear here (“Built-ins ship with the app”).

CLI cannot update in place. `dripnex-plugin uninstall <id>` then `install` again.

There is no auto-update. Phase 5 in `docs/PLUGIN_SYSTEM.md` lists it as future; [#547](https://github.com/dripnex/app/issues/547) wants a **reliable manual toggle**, not a store.

### 1.5 Official first-party vim / math / mermaid (what is actually present)

Three different things share those names. Do not collapse them.

#### Built-in renderers (always in the app)

| Manifest id       | File                                            | What it does                                                                          |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `dripnex-mermaid` | `apps/desktop/src/renderer/plugins/mermaid.tsx` | `registerCodeBlockRenderer('mermaid')` — SVG, pan/zoom, Expand                        |
| `dripnex-math`    | `apps/desktop/src/renderer/plugins/math.tsx`    | `remark-math` + `rehype-katex` + fence renderers for `math` / `latex`                 |
| `dripnex-tables`  | `apps/desktop/src/renderer/plugins/tables.tsx`  | Insert wizard, CM6 WYSIWYG widget, sortable preview, CSV. See `docs/tables-plugin.md` |

Toggling these in Settings → Installed is already a reliable on/off. They do not go through the registry.

#### Satellite insert packs (own git repos)

| Repo                                                                | Manifest id        | Release          | What it actually does                                                                               |
| ------------------------------------------------------------------- | ------------------ | ---------------- | --------------------------------------------------------------------------------------------------- |
| [dripnex/plugin-mermaid](https://github.com/dripnex/plugin-mermaid) | `mermaid`          | `v0.1.0` tarball | `insertAtCursor('```mermaid…')` + Plugins-menu item. **No renderer.**                               |
| [dripnex/plugin-math](https://github.com/dripnex/plugin-math)       | `math`             | `v0.1.0` tarball | `insertAtCursor('$$\nE = mc^2\n$$')`. **No KaTeX.**                                                 |
| [dripnex/plugin-vim](https://github.com/dripnex/plugin-vim)         | `dripnex-vim-mode` | `v1.2.0` tarball | Real `@replit/codemirror-vim`: `registerExtensions`, `registerVim`, Ex, status bar, preview `j`/`k` |
| [dripnex/plugin-stamp](https://github.com/dripnex/plugin-stamp)     | `stamp`            | `v0.1.0`         | Insert date/timestamp (not editor/GFM; already shipped)                                             |

`#339`–`#341` (“extract math/mermaid/vim out of the app”) are **stale**. The satellites exist. Math/mermaid satellites did **not** take the built-in renderers with them — they are insert snippets. Vim never shipped as a built-in (`docs/releases/v0.16.0.md`).

#### Registry vs fallback catalog — [#562](https://github.com/dripnex/app/issues/562)

Three strings for Vim are **not** interchangeable. Verified in `dripnex/plugin-vim` `manifest.json` + release `v1.2.0`:

| Role                                           | Value                   | Who uses it                               |
| ---------------------------------------------- | ----------------------- | ----------------------------------------- |
| **Manifest id** / `scan().id` / install folder | `dripnex-vim-mode`      | Scanner, enable toggle, Installed badge   |
| **GitHub repo** (working install spec)         | `dripnex/plugin-vim`    | CLI, Other package, GitHub release lookup |
| **Registry slug** (`GET /plugins/:slug`)       | _(missing on live API)_ | Browse Install button (before this PR)    |

Live `GET https://api.dripnex.app/plugins` (QA on #547 / #562, UA `Dripnex`): `mermaid`, `math`, `theme-parchment`, `stamp`. **No vim.** `GET /plugins/dripnex-vim-mode` → `404 {"error":"Plugin not found"}`.

Working artifact: [v1.2.0](https://github.com/dripnex/plugin-vim/releases/tag/v1.2.0) `dripnex-vim-mode-1.2.0.tar.gz`.

How Browse / Updates failed (v0.16.0 and `develop` before this PR):

1. `COMMUNITY_CATALOG` already had the right pair (`id: dripnex-vim-mode`, `repository: dripnex/plugin-vim`).
2. `BrowseTab` fetched the live registry. Any non-empty list **replaced** the fallback — Vim card gone.
3. Install called `installFromSpec(plugin.slug)` → `dripnex-vim-mode`. `parseConnectSpec` treats a kebab string as a **registry** slug (`githubInstall.ts`), not `owner/repo`.
4. `resolveRegistryBundle` hits `GET /plugins/dripnex-vim-mode` → 404. It never uses the known GitHub repo.
5. `UpdatesTab` matches `scan().id` to `registry.slug` only. No slug → vim never appears under Updates.
6. Fallback-only Install still failed: the button sent the catalog **id**, not `dripnex/plugin-vim`.

**Workaround today (packaged 0.16.0, no code change):** Settings → Plugins → Other package → `dripnex/plugin-vim`. Do not type `dripnex-vim-mode`.

This PR’s small slug fix (same branch, not a new install system):

- Fallback catalog is **merged** into the registry list (`mergeFallbackCatalog`), so Vim stays visible when the API omits it. If a live row is `dripnex-vim-mode` **without** `repositoryUrl`, merge fills `dripnex/plugin-vim` — Install must never fall back to the slug.
- Install / Update send `repository` (`dripnex/plugin-vim`) via `installSpecFor`, not the manifest id.
- `FIRST_PARTY_PACKAGES` gains slug `dripnex-vim-mode` with `repositoryUrl` `https://github.com/dripnex/plugin-vim` and the real v1.2.0 tarball, so `GET /plugins/dripnex-vim-mode` works after the API deploy. Slug **equals** `manifest.id`; keep `repositoryUrl` on that row.

### 1.6 CLI vs packaged userData (second install bug)

CLI `getPluginsDir()` → `resolveUserDataRoot()` in `packages/storage-core/src/data/DataPaths.ts`.

Linux/Windows candidates are `@dripnex/desktop` then `dripnex`. **`Dripnex` is not on the list.** macOS does include `…/Application Support/Dripnex`.

So `dripnex-plugin install dripnex/plugin-vim` can print success at `~/.config/@dripnex/desktop/plugins/dripnex-vim-mode` while packaged 0.16.0 scans `~/.config/Dripnex/plugins`. The pack never appears. Override: `DRIPNEX_DATA_DIR`.

### 1.7 Docs that already exist

| File                                | Role                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/PLUGIN_SYSTEM.md`             | Phase history + hackable files + catalog table. Phase 5 marketplace is later.                    |
| `docs/tables-plugin.md`             | Built-in tables, not a satellite.                                                                |
| `docs/releases/v0.16.0.md`          | User-facing: one repo per plugin, `dripnex-plugin install owner/repo`, Vim is community.         |
| `docs/NOW.md` / `docs/ROADMAP.md`   | Still say “built-in Mermaid, Vim, KaTeX” in places — **stale vs v0.16.0** (Vim is not built-in). |
| `docs/archived/plans-2026/*plugin*` | Marketplace / ecosystem designs. Icebox.                                                         |

`docs/plugins/` did not exist before this write-up.

---

## 2. Issue #547 — what it implies

[#547](https://github.com/dripnex/app/issues/547) (parent [#542](https://github.com/dripnex/app/issues/542)). Concrete packaged repro: [#562](https://github.com/dripnex/app/issues/562).

> Inkdrop: Preferences → Install, auto-update. Dripnex: `dripnex-plugin install owner/repo`. … Do **not** build a marketplace. Make install + update of vim / mermaid / math a **reliable toggle**. Done when a user can enable Vim (and mermaid/math) without cloning a repo by hand, and updates apply.

QA (same issue, 2026-08-22) already named the gaps. Implications for any **next** official pack:

| Gap                                                                         | Why a new pack would hit it too                                                                                                                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry list **replaces** `COMMUNITY_CATALOG`                              | [#562](https://github.com/dripnex/app/issues/562): a pack only in the fallback (vim) vanishes from Install when the API is up. This PR merges instead of replacing.               |
| Install button used **slug**, not `owner/repo`                              | [#562](https://github.com/dripnex/app/issues/562): `dripnex-vim-mode` is not a live registry slug → 404. Working spec is `dripnex/plugin-vim`. This PR installs via `repository`. |
| Updates match `scan().id` to `registry.slug`                                | Same mismatch: vim never appeared under Updates. This PR also checks the fallback catalog and uses `repository` as the update spec.                                               |
| CLI writes a **different userData** than packaged Electron on Linux/Windows | `dripnex-plugin install` can succeed and the app still shows nothing.                                                                                                             |
| CLI install **errors if already installed**                                 | Updates are Settings-only (overwrite) or uninstall+reinstall.                                                                                                                     |
| Math/mermaid satellites are **insert-only**                                 | “Enable mermaid/math” is already true for **rendering** (built-ins). The satellite is an extra insert command. Do not promise that installing the satellite _is_ mermaid/math.    |

#547 is **path quality**, not new surface. [#562](https://github.com/dripnex/app/issues/562) is the vim slug bug. This PR’s catalog/merge fix covers (1) and (2) in the desktop; the API first-party row covers `GET /plugins/dripnex-vim-mode` after the Worker deploy. Still open:

1. CLI and packaged desktop share one plugins dir (add `Dripnex` to `userDataRootCandidates()`, or document `DRIPNEX_DATA_DIR` as required).
2. CLI `install` still errors if the pack is already present (Settings overwrite is the update path).

Extraction issues #339–#342 stay icebox. Do not delete the built-in mermaid/math/tables renderers as part of #547.

---

## 3. Gaps vs Inkdrop-style _editor_ plugins (GFM only)

Inkdrop’s loop we already copied: `init.js` / `styles.css` / keymap, one git repo per pack, tarball on a GitHub release, Settings → Install. What we did **not** copy: a store, clipper, graph, AI notetaker.

Stay inside the existing `plugin-api`. Compare **built-in vs pack**.

### 3.1 Already in the app (do not rebuild as a pack)

| Feature                                                  | Where                                                                    | Notes                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| GFM tables                                               | Built-in `dripnex-tables` + `packages/tables`                            | Insert wizard, WYSIWYG, sortable preview, CSV. **Hunch discarded.**        |
| GFM task lists (preview)                                 | `remark-gfm` + `MarkdownPreview` `onCheckboxToggle` → `toggleNthGfmTask` | Click in preview writes `- [ ]` / `- [x]` back.                            |
| Task insert                                              | `editor:insert-checkbox`, slash `/task`                                  | Toolbar + Actions panel.                                                   |
| Checked-task strike                                      | Core `editorPolish.ts` (`cm-task-checked`)                               | Source-mode chrome, not a plugin.                                          |
| GFM footnotes (preview)                                  | `remark-gfm` + `.footnotes` CSS                                          | Renders `[^id]` / definition list. **No insert command.**                  |
| GFM strikethrough, autolinks, tables in preview          | `coreRemarkPlugins()` = `remarkGfm`                                      | Always on.                                                                 |
| GitHub alerts                                            | `remarkGithubAlert` + slash `/note`…                                     | Core, not a plugin.                                                        |
| `<mark>` highlight                                       | Selection toolbar wrap                                                   | Core.                                                                      |
| Fence language picker                                    | `FENCE_LANGUAGES` in `slash.ts`                                          | Core. No mermaid/math in that list (special-cased in `packages/markdown`). |
| Paste as link                                            | Built-in `pasteAsLink`                                                   | Mod+Shift+K.                                                               |
| Mermaid / KaTeX **render**                               | Built-in plugins above                                                   | Toggle in Installed.                                                       |
| Outline, wikilinks, embeds, emoji shortcodes             | Core packages / editor                                                   | Wikilinks are product, not a pack.                                         |
| Word count, typewriter, focus, reading time, active line | Built-in **proof** plugins                                               | `PLUGIN_SYSTEM.md`: keep off dripnex.app/plugins.                          |
| Stamp                                                    | Satellite `dripnex/plugin-stamp`                                         | Already a first-party insert pack.                                         |
| Official themes                                          | Built-in palettes + `theme-parchment` satellite                          | Themes, not editor/GFM.                                                    |

### 3.2 Real editor / GFM gaps that still fit the API

| Gap                                  | Built-in today?                                                          | Fits plugin-api?                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Second keymap (emacs)                | No. Zero `emacs` / `codemirror-emacs` hits. Vim is the only keymap pack. | Yes — same as vim: bundle `@replit/codemirror-emacs`, `registerExtensions`. No `registerEmacs` today (only `registerVim`).          |
| Footnote **editor** UX               | Preview only. No `editor:insert-footnote`.                               | Yes — `registerCommand` + `insertAtCursor` + decorations / `preview.on('a:click')` to jump. Do not re-register `remark-gfm`.        |
| Task toggle **in the source editor** | Preview click works; source has strike + insert only.                    | Yes — `registerExtensions` click/keymap on `- [ ]` / `- [x]` + `replaceRange`. Overlaps #542 “list/table/fence feel” (core polish). |
| CSV / TSV fence as a table           | GFM pipe tables only.                                                    | Yes — `registerCodeBlockRenderer('csv' \| 'tsv')`. Niche.                                                                           |
| Mermaid / math **insert**            | Slash/fence picker does not insert those fences. Satellites already do.  | Already published. #547 makes them installable, not a new pack.                                                                     |

### 3.3 Hunches, verified

The starting guess was “tables, footnotes, task-list UX, emacs.” Against the tree:

| Hunch            | Verdict                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tables**       | Already a full built-in. Do not ship a second tables pack. Extraction #342 is icebox.                                                                      |
| **Footnotes**    | Preview is done. A pack would be **insert + jump**, not a renderer. Still valid, thinner than guessed.                                                     |
| **Task-list UX** | Preview toggle + insert + strike already ship. Remaining value is **source-mode click/key toggle**. Could be a pack _or_ core editor polish (#542 item 1). |
| **Emacs**        | Strongest **new** pack. Nothing exists. Same install story as vim once #547 works.                                                                         |

### 3.4 Ask Tomás first

Only if a candidate would change product shape. Do not start these as “just a plugin”:

- Wikilinks as an optional pack (already core; `[[` is product).
- Backlinks panel / graph as a plugin (graph already exists as a knowledge map; #542: do not invent).
- Pulling mermaid/math/tables **out** of the bundle so rendering requires install (#339–#342). That changes “GFM diagrams/math/tables just work.”
- A public browse-all marketplace (Phase 5, explicit Not v1).
- Clipper, AI notetaker, iOS plugins.
- Source-mode task toggle **if** we treat click-to-check as core chrome (Inkdrop-feel) rather than an optional pack. If it is core, do not extract it.

---

## 4. Ranked next official first-party packs

Criteria: (1) fits today’s `plugin-api`, (2) GFM or editor keymap, (3) can ship as an installable pack that actually loads **after #547**, (4) user value once vim/math/mermaid install works. Proof plugins and themes are out.

Hooks marked **hypothesis** are not implemented.

### 1. Emacs keymap — `dripnex/plugin-emacs`

- **Why:** Only missing editor keymap. Vim already proved the shape. Users who will not enable Vim still want chords in the editor, not `keybindings.json` homework.
- **Hook (hypothesis):** Bundle `@replit/codemirror-emacs`. `activate`: `registerExtensions('emacs-keymap', [emacs()])`, `registerCommand` toggle, `layout.addComponent('editor-status-bar')` if we show a mode hint. Optional small API add: `registerEmacs` mirroring `registerVim` so `init.js` can map keys — that is plugin-api, not product shape.
- **Product-shape decision:** No.
- **#547 dependency:** Same catalog/slug/userData bugs as vim. Do not publish until Install + Updates work for a GitHub-only id, or register the slug on day one (`emacs` or `dripnex-emacs-mode` — pick one and use it as **both** `manifest.id` and registry slug).

### 2. Footnote insert + jump — `dripnex/plugin-footnotes`

- **Why:** GFM footnotes already render; authors still type `[^1]` by hand. High GFM value, zero renderer work.
- **Hook (hypothesis):** `registerCommand('insert')` → `insertAtCursor('[^n]')` + append definition. `decorations.addWidget` or `registerExtensions` for click-to-definition in source. `preview.on('a:click')` to scroll to `[^n]`. Do **not** add another remark plugin.
- **Product-shape decision:** No.

### 3. Source-mode task toggle — pack **or** core polish

- **Why:** Preview already checks boxes. Source mode only strikes completed tasks. The leftover is click / `Mod+Enter` on `- [ ]` in the editor.
- **Hook (hypothesis):** `registerExtensions` with a CM6 click handler + `editor.replaceRange` on the checkbox span. Reuse `toggleNthGfmTask` / `checkedTaskMarks` from `@dripnex/commands` if the pack may `require` it — **today it cannot** (`pluginRequire` whitelist). So either bundle a tiny toggler or add `@dripnex/commands` to the host whitelist (API change, not product shape).
- **Product-shape decision:** **Ask Tomás** only on _where it lives_ (core chrome vs pack). The behavior itself is GFM, not a new product.

### 4. CSV / TSV fence preview — `dripnex/plugin-csv` (optional)

- **Why:** Archived tables design mentioned a `csv` fence renderer. Fits `registerCodeBlockRenderer` exactly. Lower user value than emacs/footnotes because GFM tables already exist.
- **Hook (hypothesis):** `registerCodeBlockRenderer('csv' | 'tsv', TableView)`. Parse in the pack; do not import `apps/desktop` tables plugin.
- **Product-shape decision:** No.

### Not ranked as “next to build”

| Candidate                                      | Why not                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Tables pack                                    | Already built-in.                                                                            |
| Mermaid / math **renderers** as satellites     | Already built-in. Satellites are insert-only; #547 is enough.                                |
| Stamp                                          | Already first-party.                                                                         |
| Word count / typewriter / focus / reading time | Proof plugins.                                                                               |
| PlantUML / other diagram fences                | Same hook as mermaid; mermaid already covers diagrams. Extra renderer deps, little GFM gain. |
| Definition lists, sub/sup, smart punctuation   | Not GFM, or would auto-rewrite markdown (sacred).                                            |
| Third keymap (sublime/vscode)                  | After emacs, if anyone asks. Same hook.                                                      |

---

## 5. Out of scope

Explicit. Do not sneak these into a “plugin” PR:

- Public marketplace / browse-all store (Phase 5, [#542](https://github.com/dripnex/app/issues/542) Not v1)
- Web clipper
- Graph / backlinks-as-product
- AI notetaker (AI assistant is already a built-in)
- Wikilinks-as-optional-pack
- iOS / `dripnex/ios` plugins
- Extracting built-in mermaid/math/tables out of the app (#339–#342 icebox)
- Changing AuthGate, sync, or pricing
- Implementing any pack in this repo as part of this research

---

## 6. If we ship a new official pack (checklist)

Copied from the vim failure mode so the next repo does not repeat it:

1. `manifest.id` **===** registry `slug`. Keep `repository` as `owner/repo`. Install must send `owner/repo` (or a slug that exists on `GET /plugins/:slug` with a `bundleUrl`). Do not send the manifest id if it is not a registry slug — that is [#562](https://github.com/dripnex/app/issues/562).
2. Row on `GET /plugins` with `bundleUrl` pointing at the GitHub release tarball (`dripnex-plugin pack` asset).
3. Fallback `COMMUNITY_CATALOG` lists the same `id` + `repository`, and Browse **merges** it (does not replace).
4. Confirm packaged desktop `userData/plugins` is where the CLI wrote the files.
5. Updates tab: match `scan().id` to slug **or** fallback id; update spec is `repository`.

#547 / #562 are the path. New editor packs come after Install + Updates work for vim without typing Other package.
