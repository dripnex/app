# Theme System Enhancement — Design

**Goal:** Improve the existing theme infrastructure with a layered theme registry, token validation, plugin-defined themes, and Electron nativeTheme sync.

**Architecture:** Layered approach — base CSS tokens → theme overrides → accent color → plugin CSS vars. ThemeRegistry as a new Zustand store. nativeTheme sync via IPC.

## Token Whitelist + Extension Scopes

Core tokens that themes can override (from `tokens.css`):

```
--bg-base, --bg-surface, --bg-elevated, --bg-inset
--text-primary, --text-secondary, --text-muted, --text-faint
--border, --border-subtle, --border-strong
--glass-bg, --glass-border
--danger, --warning, --success
```

Extension scopes with mandatory prefixes:

| Scope | Prefix | Example |
|-------|--------|---------|
| Syntax highlighting | `--syntax-*` | `--syntax-keyword` |
| Preview/markdown | `--preview-*` | `--preview-heading-color` |
| UI chrome | `--ui-*` | `--ui-sidebar-bg` |

Variables outside core whitelist or valid scopes are rejected with `console.warn`.

Fallback: CSS cascade handles missing tokens — base `tokens.css` values apply automatically.

## ThemeRegistry

```typescript
interface ThemeDefinition {
  id: string;
  name: string;
  description?: string;
  author?: string;
  colorScheme: 'dark' | 'light';
  tokens: Record<string, string>;
  pluginId?: string;
}

interface ThemeRegistryState {
  themes: ThemeDefinition[];
  activeThemeId: string | null;
  register(theme: ThemeDefinition): boolean;
  unregister(themeId: string): void;
  unregisterAll(pluginId: string): void;
  setActive(themeId: string | null): void;
  getActiveTheme(): ThemeDefinition | null;
}
```

Built-in dark/light are NOT in the registry — they live in `tokens.css`. The registry is for additional themes only. `activeThemeId: null` means use base dark/light.

## Application Flow (Layers)

1. `useAppearanceSettings` applies base theme (`data-theme="dark"/"light"`)
2. `useThemeOverrides` reads active theme from ThemeRegistry, applies validated tokens as inline CSS vars on `:root`
3. Accent color applies on top (user preference always wins)
4. Plugin CSS vars (`cssVariableStore`) apply last for individual overrides

## Plugin API

```typescript
// In PluginContext
registerTheme(theme: Omit<ThemeDefinition, 'pluginId'>): () => void;
```

Themes are validated on registration. Invalid tokens are stripped. Theme appears in Settings selector if validation passes.

## nativeTheme Sync

**Main process:**
- Set `nativeTheme.themeSource` on init from saved setting
- Listen to `nativeTheme.on('updated')`, notify renderer via IPC `theme:system-changed`
- Handle `theme:set-source` IPC from renderer

**Renderer:**
- Replace `prefers-color-scheme` media query listener with IPC listener
- `window.readied.theme.onSystemChanged(isDark => ...)` for system theme changes

**Preload API:**
```typescript
theme: {
  setSource: (source: 'dark' | 'light' | 'system') => void;
  onSystemChanged: (callback: (isDark: boolean) => void) => () => void;
}
```

Benefits: native title bar matches theme, centralized source of truth, no media query race conditions.

## Settings UI

- Base scheme selector (dark/light/system) stays as-is
- Theme selector appears below ONLY when plugin themes are registered
- Accent color always visible, applies on top of any theme
- No changes to zoom or performance mode

## Scope

This PR covers infrastructure only. No new theme presets — just dark and light as built-in. The system is ready for plugins to register themes.
