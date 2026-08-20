# App state

Dripnex does **not** use Redux. Notes live in SQLite; the renderer caches them
with TanStack Query. Session UI lives in Zustand slices. Plugins see a
**read-only** projection of that, not the stores themselves.

```
SQLite  ──IPC──►  TanStack Query (notes, notebooks, tags, links)
                  Zustand        (navigation, editor buffer, settings)
                  themeRegistry  (vanilla Zustand in plugin-api)
                         │
                         ▼
                  dripnex.store.getState()   // clone, no dispatch
```

Writes from plugins go through `dripnex.commands.dispatch`, `editor`, or `data`.
There is no `store.dispatch`.

## Snapshot (`dripnex.store`)

| Key             | Source                                     | Honest meaning                                   |
| --------------- | ------------------------------------------ | ------------------------------------------------ |
| `editingNote`   | `editorBufferStore`                        | Open buffer: `id`, `content`, `isDirty`          |
| `notes.items`   | React Query via `useFilteredNotes`         | **Visible list in this window**, not the library |
| `notes.current` | selected note + live buffer when ids match | Open note                                        |
| `navigation`    | `navigationStore.navigation`               | `global` / `notebook` / `tag` / `search`         |
| `view`          | rest of `navigationStore`                  | workspace, status/tag filters, sort              |
| `settings`      | `settingsStore.settings.appearance`        | theme, accent, frost, zoom. **No API keys**      |
| `theme`         | `themeRegistryStore`                       | `activeThemeId`, `frosted`                       |

```js
const unsub = dripnex.store.subscribe(() => {
  const { editingNote, notes, navigation } = dripnex.store.getState();
  if (navigation.kind === 'notebook') {
    dripnex.log.info(notes.items.length, editingNote.isDirty);
  }
});
```

Full library access is `dripnex.app.listNotes()` / `dripnex.data.getNotes()`.

## Zustand slices (renderer)

| Store                  | File                               | Owns                            |
| ---------------------- | ---------------------------------- | ------------------------------- |
| `useNavigationStore`   | `stores/navigationStore.ts`        | What the list is showing        |
| `useEditorBufferStore` | `stores/editorBufferStore.ts`      | Live markdown for the open note |
| `useSettingsStore`     | `stores/settings/settingsStore.ts` | Persisted settings (schema v9+) |
| `themeRegistryStore`   | `@dripnex/plugin-api`              | Registered palettes + active id |
| `pluginRuntimeStore`   | `stores/pluginRuntimeStore.ts`     | Loaded plugins / errors         |

Do not put note lists in Zustand. Query is the cache.

## Query keys

Defined in `hooks/useNotes.ts` and `hooks/useNotebooks.ts`.

| Factory                           | Key                                   |
| --------------------------------- | ------------------------------------- |
| `noteKeys.all`                    | `['notes']`                           |
| `noteKeys.list(options)`          | `['notes', 'list', options]`          |
| `noteKeys.detail(id)`             | `['notes', 'detail', id]`             |
| `noteKeys.search(query, options)` | `['notes', 'search', query, options]` |
| `noteKeys.tags()`                 | `['notes', 'tags']`                   |
| `noteKeys.counts()`               | `['notes', 'counts']`                 |
| `notebookKeys`                    | notebooks + tree                      |

`listOptionsFromNav` is how navigation becomes a list query. The store facade
reads the **already-fetched** visible list; it does not invent a second query.

## CSS token owners

Inline styles on `document.documentElement` win over `tokens.css`.

| Token                               | Default         | Theme palette                                             | Settings overlay                                               |
| ----------------------------------- | --------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| `--accent`                          | `tokens.css`    | `theme.tokens`                                            | `appearance.accentColor` (`useAppearanceSettings`)             |
| `--accent-primary`                  | `var(--accent)` | copied from `--accent` if omitted (`validateThemeTokens`) | same overlay as `--accent`                                     |
| `--accent-hover` / `--accent-muted` | `tokens.css`    | palette                                                   | computed from overlay accent                                   |
| `--bg-*`, `--glass-*`               | `tokens.css`    | palette (frosted palettes use alpha)                      | `frostTransparency` scales alpha; Performance **Low** flattens |
| `--cm-*`                            | `tokens.css`    | `--cm-` extension scope                                   | none                                                           |
| `--text-*`, `--border-*`            | `tokens.css`    | palette                                                   | none                                                           |

`--accent-primary` is a **core** theme token (`CORE_THEME_TOKENS`). Chrome
(buttons, settings, banners) reads it. Palettes must own it — they do not have
to spell it out; registration fills it from `--accent`.

Writer order in a window:

1. `tokens.css` (base light/dark)
2. `useThemeOverrides` — active palette tokens
3. `useAppearanceSettings` — user accent, zoom, frost slider

## Per-window caveat

Zustand in the renderer is **per BrowserWindow**. Settings is a separate window.
Persisted settings sync over IPC (`settings:changed`); the theme registry does
not. Restoring `appearance.activeThemeId` in each window is mandatory.

## Host wiring

`usePluginStoreBridge` (notes window) registers `setHostStoreSnapshot` and
notifies on editor / navigation / settings / theme / visible-list changes.
`@dripnex/plugin-api` never imports desktop Zustand.
