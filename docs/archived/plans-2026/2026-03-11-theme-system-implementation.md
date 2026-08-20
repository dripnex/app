# Theme System Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a layered theme registry with token validation, plugin-defined themes, and Electron nativeTheme sync.

**Architecture:** ThemeRegistry Zustand store validates and stores theme definitions. A `useThemeOverrides` hook applies active theme tokens to `:root`. Main process syncs `nativeTheme.themeSource` with renderer via IPC. Plugin API exposes `registerTheme()`.

**Tech Stack:** TypeScript, Zustand (vanilla), Electron nativeTheme, CSS custom properties, React hooks

---

### Task 1: Define theme types and token whitelist

**Files:**

- Create: `packages/plugin-api/src/theme/themeTypes.ts`

**Step 1: Create the types file**

```typescript
/**
 * Theme System Types
 *
 * Defines ThemeDefinition and the token whitelist for validation.
 */

/** Core CSS tokens that themes are allowed to override */
export const CORE_THEME_TOKENS = [
  // Backgrounds
  '--bg-base',
  '--bg-surface',
  '--bg-elevated',
  '--bg-inset',
  // Text
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-faint',
  // Borders
  '--border',
  '--border-subtle',
  '--border-strong',
  // Glass
  '--glass-bg',
  '--glass-border',
  '--glass-bg-menu',
  '--glass-border-menu',
  // Semantic
  '--danger',
  '--danger-muted',
  '--warning',
  '--warning-muted',
  '--success',
  '--success-muted',
  // Status
  '--status-active',
  '--status-on-hold',
  '--status-completed',
  '--status-dropped',
] as const;

/** Valid extension scope prefixes for non-core tokens */
export const THEME_EXTENSION_SCOPES = ['--syntax-', '--preview-', '--ui-'] as const;

/** A complete theme definition */
export interface ThemeDefinition {
  /** Unique theme ID */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description?: string;
  /** Theme author */
  author?: string;
  /** Base color scheme this theme builds on (determines fallback values) */
  colorScheme: 'dark' | 'light';
  /** CSS custom property overrides — must pass token validation */
  tokens: Record<string, string>;
  /** Plugin that registered this theme (undefined for built-in) */
  pluginId?: string;
}

/**
 * Validate a token name against the whitelist and extension scopes.
 * Returns true if the token is allowed.
 */
export function isValidThemeToken(token: string): boolean {
  if ((CORE_THEME_TOKENS as readonly string[]).includes(token)) return true;
  return THEME_EXTENSION_SCOPES.some(prefix => token.startsWith(prefix));
}

/**
 * Validate and filter theme tokens.
 * Returns only valid tokens. Warns about rejected ones.
 */
export function validateThemeTokens(
  tokens: Record<string, string>,
  themeId: string
): Record<string, string> {
  const valid: Record<string, string> = {};
  for (const [token, value] of Object.entries(tokens)) {
    if (isValidThemeToken(token)) {
      valid[token] = value;
    } else {
      console.warn(`[ThemeRegistry] Theme "${themeId}": rejected invalid token "${token}"`);
    }
  }
  return valid;
}
```

**Step 2: Commit**

```bash
git add packages/plugin-api/src/theme/themeTypes.ts
git commit -m "feat(plugin-api): add theme types and token whitelist"
```

---

### Task 2: Create ThemeRegistry store

**Files:**

- Create: `packages/plugin-api/src/theme/themeRegistryStore.ts`
- Modify: `packages/plugin-api/src/index.ts` (add exports)

**Step 1: Create the store**

```typescript
/**
 * Theme Registry Store
 *
 * Zustand vanilla store for registered themes.
 * Validates tokens on registration. Manages active theme state.
 */

import { createStore } from 'zustand/vanilla';
import type { ThemeDefinition } from './themeTypes';
import { validateThemeTokens } from './themeTypes';

interface ThemeRegistryState {
  /** All registered themes */
  themes: ThemeDefinition[];
  /** Currently active theme ID (null = use base dark/light) */
  activeThemeId: string | null;
  /** Register a theme. Returns false if no valid tokens after validation. */
  register(theme: ThemeDefinition): boolean;
  /** Unregister a theme by ID */
  unregister(themeId: string): void;
  /** Unregister all themes from a plugin */
  unregisterAll(pluginId: string): void;
  /** Set the active theme (null to revert to base) */
  setActive(themeId: string | null): void;
  /** Get the active theme definition, or null */
  getActiveTheme(): ThemeDefinition | null;
}

export const themeRegistryStore = createStore<ThemeRegistryState>((set, get) => ({
  themes: [],
  activeThemeId: null,

  register(theme) {
    const validTokens = validateThemeTokens(theme.tokens, theme.id);
    if (Object.keys(validTokens).length === 0) {
      console.warn(`[ThemeRegistry] Theme "${theme.id}" has no valid tokens, skipping.`);
      return false;
    }

    const validated: ThemeDefinition = { ...theme, tokens: validTokens };
    set(state => ({
      themes: [...state.themes.filter(t => t.id !== theme.id), validated],
    }));
    console.debug(
      `[ThemeRegistry] Registered: "${theme.name}" (${Object.keys(validTokens).length} tokens)`
    );
    return true;
  },

  unregister(themeId) {
    set(state => {
      const next: Partial<ThemeRegistryState> = {
        themes: state.themes.filter(t => t.id !== themeId),
      };
      // Deactivate if the removed theme was active
      if (state.activeThemeId === themeId) {
        next.activeThemeId = null;
      }
      return next as ThemeRegistryState;
    });
  },

  unregisterAll(pluginId) {
    set(state => {
      const remaining = state.themes.filter(t => t.pluginId !== pluginId);
      const activeRemoved =
        state.activeThemeId && !remaining.some(t => t.id === state.activeThemeId);
      return {
        themes: remaining,
        activeThemeId: activeRemoved ? null : state.activeThemeId,
      } as ThemeRegistryState;
    });
  },

  setActive(themeId) {
    if (themeId !== null) {
      const exists = get().themes.some(t => t.id === themeId);
      if (!exists) {
        console.warn(`[ThemeRegistry] Theme "${themeId}" not found, ignoring setActive.`);
        return;
      }
    }
    set({ activeThemeId: themeId });
  },

  getActiveTheme() {
    const { themes, activeThemeId } = get();
    if (!activeThemeId) return null;
    return themes.find(t => t.id === activeThemeId) ?? null;
  },
}));
```

**Step 2: Export from barrel**

Add to `packages/plugin-api/src/index.ts`:

```typescript
export { themeRegistryStore } from './theme/themeRegistryStore';
export {
  isValidThemeToken,
  validateThemeTokens,
  CORE_THEME_TOKENS,
  THEME_EXTENSION_SCOPES,
} from './theme/themeTypes';
export type { ThemeDefinition } from './theme/themeTypes';
```

**Step 3: Commit**

```bash
git add packages/plugin-api/src/theme/themeRegistryStore.ts packages/plugin-api/src/index.ts
git commit -m "feat(plugin-api): add ThemeRegistry store with validation"
```

---

### Task 3: Create useThemeOverrides hook

**Files:**

- Create: `packages/plugin-api/src/theme/useThemeOverrides.ts`
- Modify: `packages/plugin-api/src/index.ts` (add export)

**Step 1: Create the hook**

```typescript
/**
 * useThemeOverrides Hook
 *
 * Applies active theme tokens from ThemeRegistry to document.documentElement.
 * Call once in app root, AFTER useAppearanceSettings.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { themeRegistryStore } from './themeRegistryStore';

const subscribe = (cb: () => void) => themeRegistryStore.subscribe(cb);
const getSnapshot = () => ({
  activeThemeId: themeRegistryStore.getState().activeThemeId,
  themes: themeRegistryStore.getState().themes,
});

export function useThemeOverrides(): void {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    const theme = themeRegistryStore.getState().getActiveTheme();
    const applied = new Set<string>();

    if (theme) {
      // Set base color scheme so CSS fallbacks work
      root.setAttribute('data-theme', theme.colorScheme);

      // Apply theme tokens
      for (const [prop, value] of Object.entries(theme.tokens)) {
        root.style.setProperty(prop, value);
        applied.add(prop);
      }
    }

    return () => {
      // Remove applied properties so base tokens take over
      for (const prop of applied) {
        root.style.removeProperty(prop);
      }
    };
  }, [state.activeThemeId, state.themes]);
}
```

**Step 2: Export from barrel**

Add to `packages/plugin-api/src/index.ts`:

```typescript
export { useThemeOverrides } from './theme/useThemeOverrides';
```

**Step 3: Commit**

```bash
git add packages/plugin-api/src/theme/useThemeOverrides.ts packages/plugin-api/src/index.ts
git commit -m "feat(plugin-api): add useThemeOverrides hook"
```

---

### Task 4: Wire useThemeOverrides into App.tsx

**Files:**

- Modify: `apps/desktop/src/renderer/App.tsx`

**Step 1: Add the hook call**

Find where `useCssVariables()` is called (around line 78). Add `useThemeOverrides()` between `useAppearanceSettings()` and `useCssVariables()`:

```typescript
import { useThemeOverrides } from '@dripnex/plugin-api';

// Inside NotesApp component:
usePerformanceMode();
useAppearanceSettings();
useThemeOverrides(); // NEW — applies active theme tokens
useCssVariables();
```

Order matters:

1. `useAppearanceSettings` sets base `data-theme` + accent
2. `useThemeOverrides` overrides with active theme tokens (may change `data-theme`)
3. `useCssVariables` applies individual plugin CSS vars on top

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): wire useThemeOverrides into app initialization"
```

---

### Task 5: Add registerTheme to PluginContext

**Files:**

- Modify: `packages/plugin-api/src/types.ts` (add to PluginContext interface)
- Modify: `packages/plugin-api/src/lifecycle/PluginRegistry.ts` (implement in activate)

**Step 1: Add to PluginContext interface**

In `types.ts`, add to the `PluginContext` interface:

```typescript
/** Register a complete theme with validated tokens */
registerTheme(theme: {
  id: string;
  name: string;
  description?: string;
  author?: string;
  colorScheme: 'dark' | 'light';
  tokens: Record<string, string>;
}): () => void;
```

**Step 2: Implement in PluginRegistry.activate()**

In `PluginRegistry.ts`, import `themeRegistryStore`:

```typescript
import { themeRegistryStore } from '../theme/themeRegistryStore';
```

Add to the context object inside `activate()`:

```typescript
registerTheme: (theme): (() => void) => {
  themeRegistryStore.getState().register({
    ...theme,
    pluginId: id,
  });
  return () => themeRegistryStore.getState().unregister(theme.id);
},
```

Add cleanup in `deactivate()` (after existing cleanup lines):

```typescript
// Cleanup theme registrations
themeRegistryStore.getState().unregisterAll(id);
```

Also add cleanup in the catch block of `activate()` (error recovery):

```typescript
themeRegistryStore.getState().unregisterAll(id);
```

**Step 3: Commit**

```bash
git add packages/plugin-api/src/types.ts packages/plugin-api/src/lifecycle/PluginRegistry.ts
git commit -m "feat(plugin-api): add registerTheme to PluginContext"
```

---

### Task 6: nativeTheme sync — main process

**Files:**

- Modify: `apps/desktop/src/main/index.ts`

**Step 1: Add nativeTheme IPC handlers**

At the top of the file, import nativeTheme:

```typescript
import { nativeTheme } from 'electron';
```

Add IPC handlers (near other IPC handler registrations):

```typescript
// Theme — sync Electron nativeTheme with renderer
ipcMain.on('theme:set-source', (_event, source: string) => {
  if (source === 'dark' || source === 'light' || source === 'system') {
    nativeTheme.themeSource = source;
  }
});

// Notify all renderer windows when system theme changes
nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('theme:system-changed', isDark);
  }
});
```

**Step 2: Commit**

```bash
git add apps/desktop/src/main/index.ts
git commit -m "feat(desktop): add nativeTheme IPC sync in main process"
```

---

### Task 7: nativeTheme sync — preload API

**Files:**

- Modify: `apps/desktop/src/preload/index.ts`

**Step 1: Add theme methods to DripnexAPI**

In the `DripnexAPI` interface, add:

```typescript
theme: {
  /** Set Electron's native theme source */
  setSource: (source: 'dark' | 'light' | 'system') => void;
  /** Listen for system theme changes from main process */
  onSystemChanged: (callback: (isDark: boolean) => void) => () => void;
};
```

In the `contextBridge.exposeInMainWorld('dripnex', ...)` implementation:

```typescript
theme: {
  setSource: (source: string) => {
    ipcRenderer.send('theme:set-source', source);
  },
  onSystemChanged: (callback: (isDark: boolean) => void) => {
    const handler = (_event: unknown, isDark: boolean) => callback(isDark);
    ipcRenderer.on('theme:system-changed', handler);
    return () => {
      ipcRenderer.removeListener('theme:system-changed', handler);
    };
  },
},
```

**Step 2: Commit**

```bash
git add apps/desktop/src/preload/index.ts
git commit -m "feat(desktop): add theme IPC bridge in preload"
```

---

### Task 8: Update useAppearanceSettings to use nativeTheme IPC

**Files:**

- Modify: `apps/desktop/src/renderer/hooks/useAppearanceSettings.ts`

**Step 1: Replace media query listener with IPC**

Current code uses `window.matchMedia('(prefers-color-scheme: dark)')` for system theme detection. Replace with the IPC bridge:

```typescript
import { useEffect } from 'react';
import { useSettingsStore, selectAppearance } from '../stores/settings';
import { computeHoverColor, hexToRgb } from '../utils/colorUtils';

function applyAppearance(
  theme: string,
  accentColor: string,
  zoomLevel: string,
  isDark?: boolean
): void {
  let resolved: string;
  if (theme === 'system') {
    // Use provided isDark hint, or fall back to media query for initial render
    resolved =
      (isDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  } else {
    resolved = theme;
  }
  document.documentElement.setAttribute('data-theme', resolved);

  // Accent color
  document.documentElement.style.setProperty('--accent', accentColor);
  document.documentElement.style.setProperty('--accent-primary', accentColor);

  // Hover variant
  const hoverColor = computeHoverColor(accentColor);
  document.documentElement.style.setProperty('--accent-hover', hoverColor);

  // Muted variant
  const rgb = hexToRgb(accentColor);
  if (rgb) {
    document.documentElement.style.setProperty(
      '--accent-muted',
      `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.15)`
    );
  }

  // Zoom
  document.body.style.zoom = zoomLevel;
}

export function useAppearanceSettings(): void {
  const appearance = useSettingsStore(selectAppearance);

  const theme = appearance?.theme || 'dark';
  const accentColor = appearance?.accentColor || '#5eead4';
  const zoomLevel = appearance?.zoomLevel || '1.0';

  // Apply settings to DOM whenever they change
  useEffect(() => {
    applyAppearance(theme, accentColor, zoomLevel);
  }, [theme, accentColor, zoomLevel]);

  // Sync nativeTheme source in main process
  useEffect(() => {
    window.dripnex.theme.setSource(theme);
  }, [theme]);

  // Listen for system theme changes via IPC (replaces media query listener)
  useEffect(() => {
    if (theme !== 'system') return;

    const unsub = window.dripnex.theme.onSystemChanged(isDark => {
      applyAppearance('system', accentColor, zoomLevel, isDark);
    });
    return unsub;
  }, [theme, accentColor, zoomLevel]);
}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/hooks/useAppearanceSettings.ts
git commit -m "feat(desktop): use nativeTheme IPC for system theme detection"
```

---

### Task 9: Add activeThemeId to AppearanceSettings

**Files:**

- Modify: `apps/desktop/src/renderer/stores/settings/schema.ts`

**Step 1: Add field**

In `AppearanceSettings` interface:

```typescript
/** Active plugin theme ID (null = use base dark/light) */
activeThemeId: string | null;
```

In `DEFAULT_APPEARANCE`:

```typescript
activeThemeId: null,
```

**Step 2: Bump SETTINGS_VERSION to 2 and add migration**

Actually — per the comment in schema.ts, version bumps require migration logic in settingsStore.ts. Since `activeThemeId` defaults to `null` and missing keys naturally default to `undefined` which is falsy, this is safe to add without a migration. Keep version at 1 and just add the field with default.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/settings/schema.ts
git commit -m "feat(desktop): add activeThemeId to appearance settings"
```

---

### Task 10: Update AppearanceSection UI with theme selector

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/AppearanceSection.tsx`

**Step 1: Add theme selector (only shown when themes exist)**

Import the theme registry:

```typescript
import { useSyncExternalStore } from 'react';
import { themeRegistryStore } from '@dripnex/plugin-api';
```

Inside the component, subscribe to themes:

```typescript
const themeRegs = useSyncExternalStore(
  themeRegistryStore.subscribe,
  () => themeRegistryStore.getState().themes
);
const activeThemeId = useSyncExternalStore(
  themeRegistryStore.subscribe,
  () => themeRegistryStore.getState().activeThemeId
);
```

Add handler:

```typescript
const handlePluginThemeChange = (value: string) => {
  const newId = value === 'default' ? null : value;
  themeRegistryStore.getState().setActive(newId);
  updateAppearance({ activeThemeId: newId });
};
```

Add UI below the accent color picker (inside the "Theme" SettingGroup), only if themes are registered:

```typescript
{themeRegs.length > 0 && (
  <SettingRow
    label="Plugin Theme"
    description="Apply a theme from an installed plugin"
    htmlFor="pluginTheme"
  >
    <Select
      id="pluginTheme"
      value={activeThemeId ?? 'default'}
      onChange={handlePluginThemeChange}
      options={[
        { value: 'default', label: 'Default' },
        ...themeRegs.map(t => ({
          value: t.id,
          label: `${t.name} (${t.colorScheme})`,
        })),
      ]}
    />
  </SettingRow>
)}
```

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/pages/settings/sections/AppearanceSection.tsx
git commit -m "feat(desktop): add plugin theme selector to Appearance settings"
```

---

### Task 11: Restore active theme on app startup

**Files:**

- Modify: `apps/desktop/src/renderer/App.tsx` (or the hook that initializes plugins)

**Step 1: After plugins load, restore activeThemeId from settings**

In `App.tsx` or wherever the plugin loading completes, add logic to restore the saved theme:

```typescript
// After plugin runtime initializes, restore saved theme
useEffect(
  () => {
    const savedThemeId = appearance?.activeThemeId;
    if (savedThemeId) {
      themeRegistryStore.getState().setActive(savedThemeId);
    }
  },
  [
    /* run once after plugin init */
  ]
);
```

The exact placement depends on plugin loading lifecycle — the theme must be restored AFTER plugins have registered their themes.

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): restore active plugin theme on startup"
```

---

### Task 12: Tests for themeTypes validation

**Files:**

- Create: `packages/plugin-api/tests/themeTypes.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { isValidThemeToken, validateThemeTokens } from '../src/theme/themeTypes';

describe('isValidThemeToken', () => {
  it('accepts core tokens', () => {
    expect(isValidThemeToken('--bg-base')).toBe(true);
    expect(isValidThemeToken('--text-primary')).toBe(true);
    expect(isValidThemeToken('--danger')).toBe(true);
  });

  it('accepts extension scope tokens', () => {
    expect(isValidThemeToken('--syntax-keyword')).toBe(true);
    expect(isValidThemeToken('--preview-heading-color')).toBe(true);
    expect(isValidThemeToken('--ui-sidebar-bg')).toBe(true);
  });

  it('rejects unknown tokens', () => {
    expect(isValidThemeToken('--custom-thing')).toBe(false);
    expect(isValidThemeToken('--accent')).toBe(false); // accent is user-controlled
    expect(isValidThemeToken('color')).toBe(false);
  });
});

describe('validateThemeTokens', () => {
  it('returns only valid tokens', () => {
    const result = validateThemeTokens(
      {
        '--bg-base': '#000',
        '--text-primary': '#fff',
        '--invalid-token': 'red',
        '--syntax-keyword': '#f0f',
      },
      'test-theme'
    );

    expect(result).toEqual({
      '--bg-base': '#000',
      '--text-primary': '#fff',
      '--syntax-keyword': '#f0f',
    });
  });

  it('returns empty object for all-invalid tokens', () => {
    const result = validateThemeTokens(
      {
        '--nope': 'red',
      },
      'test-theme'
    );
    expect(result).toEqual({});
  });
});
```

**Step 2: Run tests**

```bash
pnpm --filter @dripnex/plugin-api test
```

**Step 3: Commit**

```bash
git add packages/plugin-api/tests/themeTypes.test.ts
git commit -m "test(plugin-api): add theme token validation tests"
```

---

### Task 13: Tests for ThemeRegistry store

**Files:**

- Create: `packages/plugin-api/tests/themeRegistryStore.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { themeRegistryStore } from '../src/theme/themeRegistryStore';

const makeTheme = (overrides = {}) => ({
  id: 'test-theme',
  name: 'Test Theme',
  colorScheme: 'dark' as const,
  tokens: { '--bg-base': '#111', '--text-primary': '#eee' },
  pluginId: 'test-plugin',
  ...overrides,
});

describe('themeRegistryStore', () => {
  beforeEach(() => {
    // Clear all themes
    const state = themeRegistryStore.getState();
    for (const t of state.themes) {
      state.unregister(t.id);
    }
    state.setActive(null);
  });

  it('registers a valid theme', () => {
    const result = themeRegistryStore.getState().register(makeTheme());
    expect(result).toBe(true);
    expect(themeRegistryStore.getState().themes).toHaveLength(1);
  });

  it('rejects theme with no valid tokens', () => {
    const result = themeRegistryStore
      .getState()
      .register(makeTheme({ tokens: { '--invalid': 'red' } }));
    expect(result).toBe(false);
    expect(themeRegistryStore.getState().themes).toHaveLength(0);
  });

  it('strips invalid tokens but keeps valid ones', () => {
    themeRegistryStore
      .getState()
      .register(makeTheme({ tokens: { '--bg-base': '#000', '--nope': 'red' } }));
    const theme = themeRegistryStore.getState().themes[0]!;
    expect(theme.tokens).toEqual({ '--bg-base': '#000' });
  });

  it('unregister removes theme and deactivates if active', () => {
    themeRegistryStore.getState().register(makeTheme());
    themeRegistryStore.getState().setActive('test-theme');
    themeRegistryStore.getState().unregister('test-theme');
    expect(themeRegistryStore.getState().themes).toHaveLength(0);
    expect(themeRegistryStore.getState().activeThemeId).toBeNull();
  });

  it('unregisterAll removes all themes for a plugin', () => {
    themeRegistryStore.getState().register(makeTheme({ id: 'a', pluginId: 'p1' }));
    themeRegistryStore.getState().register(makeTheme({ id: 'b', pluginId: 'p1' }));
    themeRegistryStore.getState().register(makeTheme({ id: 'c', pluginId: 'p2' }));
    themeRegistryStore.getState().unregisterAll('p1');
    expect(themeRegistryStore.getState().themes).toHaveLength(1);
    expect(themeRegistryStore.getState().themes[0]!.id).toBe('c');
  });

  it('setActive ignores unknown theme ID', () => {
    themeRegistryStore.getState().setActive('nonexistent');
    expect(themeRegistryStore.getState().activeThemeId).toBeNull();
  });

  it('getActiveTheme returns the active theme', () => {
    themeRegistryStore.getState().register(makeTheme());
    themeRegistryStore.getState().setActive('test-theme');
    const active = themeRegistryStore.getState().getActiveTheme();
    expect(active?.id).toBe('test-theme');
  });
});
```

**Step 2: Run tests**

```bash
pnpm --filter @dripnex/plugin-api test
```

**Step 3: Commit**

```bash
git add packages/plugin-api/tests/themeRegistryStore.test.ts
git commit -m "test(plugin-api): add ThemeRegistry store tests"
```

---

### Task 14: Typecheck and full test run

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

**Step 2: Run tests**

```bash
pnpm test
```

**Step 3: Fix any issues found**

**Step 4: Final commit if needed**
