# Phase 2 Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close remaining Phase 2 gaps — fix pluginScanner type bug, add config value validation, and build a dev-mode Plugin Inspector.

**Architecture:** Three independent changes: (1) align pluginScanner types with plugin-api types, (2) add a pure validation function for config values and hook it into PluginsSection, (3) add a collapsible dev-only Plugin Inspector panel in PluginsSection showing loaded/failed plugins with timing data.

**Tech Stack:** TypeScript, React, Zustand (vanilla store), Vitest, CSS Modules

---

### Task 1: Fix pluginScanner Type Bug

**Files:**

- Modify: `apps/desktop/src/main/pluginScanner.ts`

**Context:** The `PluginConfigSchemaField` type in `pluginScanner.ts` (line 11-15) only has `'string' | 'number' | 'boolean'` but the canonical type in `packages/plugin-api/src/types.ts` (line 70-82) also has `'enum' | 'range'` with `options`, `min`, `max`, `step` fields. Community plugins with enum/range configs would have their schema silently narrowed.

**Step 1: Update the type**

In `apps/desktop/src/main/pluginScanner.ts`, replace the `PluginConfigSchemaField` interface (lines 11-15) with:

```typescript
export interface PluginConfigSchemaField {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'range';
  default: unknown;
  description?: string;
  /** For 'enum' type: available options */
  options?: Array<{ value: string; label: string }>;
  /** For 'range' type: minimum value */
  min?: number;
  /** For 'range' type: maximum value */
  max?: number;
  /** For 'range' type: step increment */
  step?: number;
}
```

**Step 2: Verify build**

Run: `pnpm --filter @dripnex/desktop typecheck`

**Step 3: Commit**

```bash
git add apps/desktop/src/main/pluginScanner.ts
git commit -m "fix(plugins): add enum and range to pluginScanner config schema type"
```

---

### Task 2: Add Config Value Validation Function

**Files:**

- Modify: `packages/plugin-api/src/validation.ts`
- Modify: `packages/plugin-api/tests/validation.test.ts`

**Context:** Config values are persisted without type checking. The UI controls provide soft constraints via HTML, but nothing prevents invalid values at the storage layer. We add a pure `validateConfigValue()` function.

**Step 1: Write the tests**

In `packages/plugin-api/tests/validation.test.ts`, add a new describe block at the end of the file:

```typescript
describe('validateConfigValue', () => {
  it('accepts valid boolean', () => {
    const field: PluginConfigSchemaField = { type: 'boolean', default: false };
    expect(validateConfigValue(field, true)).toEqual({ valid: true });
  });

  it('rejects non-boolean for boolean field', () => {
    const field: PluginConfigSchemaField = { type: 'boolean', default: false };
    const result = validateConfigValue(field, 'yes');
    expect(result.valid).toBe(false);
  });

  it('accepts valid string', () => {
    const field: PluginConfigSchemaField = { type: 'string', default: '' };
    expect(validateConfigValue(field, 'hello')).toEqual({ valid: true });
  });

  it('rejects non-string for string field', () => {
    const field: PluginConfigSchemaField = { type: 'string', default: '' };
    const result = validateConfigValue(field, 42);
    expect(result.valid).toBe(false);
  });

  it('accepts valid number', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 0 };
    expect(validateConfigValue(field, 5)).toEqual({ valid: true });
  });

  it('rejects non-number for number field', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 0 };
    const result = validateConfigValue(field, 'five');
    expect(result.valid).toBe(false);
  });

  it('rejects number below min', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 5, min: 1 };
    const result = validateConfigValue(field, 0);
    expect(result.valid).toBe(false);
  });

  it('rejects number above max', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 5, max: 10 };
    const result = validateConfigValue(field, 15);
    expect(result.valid).toBe(false);
  });

  it('accepts valid enum value', () => {
    const field: PluginConfigSchemaField = {
      type: 'enum',
      default: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };
    expect(validateConfigValue(field, 'a')).toEqual({ valid: true });
  });

  it('rejects invalid enum value', () => {
    const field: PluginConfigSchemaField = {
      type: 'enum',
      default: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };
    const result = validateConfigValue(field, 'c');
    expect(result.valid).toBe(false);
  });

  it('rejects enum with no options defined', () => {
    const field: PluginConfigSchemaField = { type: 'enum', default: 'a' };
    const result = validateConfigValue(field, 'a');
    expect(result.valid).toBe(false);
  });

  it('accepts valid range value', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    expect(validateConfigValue(field, 5)).toEqual({ valid: true });
  });

  it('rejects range below min', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    const result = validateConfigValue(field, -1);
    expect(result.valid).toBe(false);
  });

  it('rejects range above max', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    const result = validateConfigValue(field, 11);
    expect(result.valid).toBe(false);
  });

  it('rejects non-number for range field', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    const result = validateConfigValue(field, 'five');
    expect(result.valid).toBe(false);
  });
});
```

Add the import at the top alongside existing imports:

```typescript
import { validateManifest, assertValidManifest, validateConfigValue } from '../src/validation';
import type { PluginConfigSchemaField } from '../src/types';
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @dripnex/plugin-api test`
Expected: FAIL — `validateConfigValue` is not exported yet.

**Step 3: Implement the validation function**

In `packages/plugin-api/src/validation.ts`, add the import at the top:

```typescript
import type { PluginManifest, PluginConfigSchemaField } from './types';
```

(Replace the existing `import type { PluginManifest } from './types';`)

Add at the end of the file:

```typescript
export interface ConfigValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a config value against its schema field definition.
 *
 * Pure function — no side effects. Returns { valid: true } or { valid: false, reason }.
 */
export function validateConfigValue(
  field: PluginConfigSchemaField,
  value: unknown
): ConfigValidationResult {
  switch (field.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, reason: `Expected boolean, got ${typeof value}` };
      }
      return { valid: true };

    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, reason: `Expected string, got ${typeof value}` };
      }
      return { valid: true };

    case 'number':
      if (typeof value !== 'number') {
        return { valid: false, reason: `Expected number, got ${typeof value}` };
      }
      if (field.min !== undefined && value < field.min) {
        return { valid: false, reason: `Value ${value} is below minimum ${field.min}` };
      }
      if (field.max !== undefined && value > field.max) {
        return { valid: false, reason: `Value ${value} is above maximum ${field.max}` };
      }
      return { valid: true };

    case 'enum':
      if (!field.options || field.options.length === 0) {
        return { valid: false, reason: 'Enum field has no options defined' };
      }
      if (!field.options.some(opt => opt.value === value)) {
        return { valid: false, reason: `Value "${value}" is not a valid option` };
      }
      return { valid: true };

    case 'range':
      if (typeof value !== 'number') {
        return { valid: false, reason: `Expected number, got ${typeof value}` };
      }
      if (field.min !== undefined && value < field.min) {
        return { valid: false, reason: `Value ${value} is below minimum ${field.min}` };
      }
      if (field.max !== undefined && value > field.max) {
        return { valid: false, reason: `Value ${value} is above maximum ${field.max}` };
      }
      return { valid: true };

    default:
      return {
        valid: false,
        reason: `Unknown field type: ${(field as PluginConfigSchemaField).type}`,
      };
  }
}
```

**Step 4: Export from package**

In `packages/plugin-api/src/index.ts`, find the existing validation export line and update it:

```typescript
export { validateManifest, assertValidManifest, validateConfigValue } from './validation.js';
```

If this export doesn't exist yet, add it.

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dripnex/plugin-api test`
Expected: All tests pass (existing + 15 new).

**Step 6: Commit**

```bash
git add packages/plugin-api/src/validation.ts packages/plugin-api/src/index.ts packages/plugin-api/tests/validation.test.ts
git commit -m "feat(plugin-api): add validateConfigValue for config schema enforcement"
```

---

### Task 3: Wire Validation into PluginsSection

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx`

**Context:** The `handleConfigChange` callback (line 487-493) saves config values directly without validation. We add a validation check that logs and skips invalid values.

**Step 1: Add import**

In `PluginsSection.tsx`, update the import from preload to also import the validation function. Since PluginsSection imports types from `preload/index`, and we need the validation function from `@dripnex/plugin-api`:

```typescript
import { validateConfigValue } from '@dripnex/plugin-api';
```

Add this alongside the existing imports at the top of the file.

**Step 2: Add validation to handleConfigChange**

Replace the `handleConfigChange` callback (lines 487-493) with:

```typescript
const handleConfigChange = useCallback(
  async (pluginId: string, key: string, value: unknown) => {
    // Find the schema field for validation
    const schema =
      BUILT_IN_CONFIG_SCHEMAS[pluginId] ?? plugins.find(p => p.id === pluginId)?.configSchema;
    const field = schema?.[key];

    if (field) {
      const result = validateConfigValue(field, value);
      if (!result.valid) {
        console.warn(`[plugin:${pluginId}] Invalid config value for "${key}": ${result.reason}`);
        return;
      }
    }

    await window.dripnex.pluginConfig.set(pluginId, key, value);
    setConfigValues(prev => ({
      ...prev,
      [pluginId]: { ...prev[pluginId], [key]: value },
    }));
  },
  [plugins]
);
```

Note: `plugins` is now in the dependency array since we access it for community plugin schemas.

**Step 3: Verify build**

Run: `pnpm --filter @dripnex/desktop typecheck`

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx
git commit -m "feat(plugins): validate config values before persisting"
```

---

### Task 4: Add Load Timing to pluginRuntimeStore

**Files:**

- Modify: `apps/desktop/src/renderer/stores/pluginRuntimeStore.ts`

**Context:** The Plugin Inspector needs to show how long each plugin took to load. We add timing metadata to the scan results.

**Step 1: Add timing interface and tracking**

In `pluginRuntimeStore.ts`, add a new interface after `PluginLoadError` (line 16-20):

```typescript
export interface PluginLoadTiming {
  pluginId: string;
  pluginName: string;
  loadTimeMs: number;
}
```

Add `timings` to `PluginRuntimeState` (after `errors` on line 28):

```typescript
/** Load timing for each plugin */
timings: PluginLoadTiming[];
```

Update the `executeScan` return type (line 56) to include timings:

```typescript
async function executeScan(generation: number): Promise<{
  plugins: PluginManifest[];
  errors: PluginLoadError[];
  timings: PluginLoadTiming[];
} | null> {
```

Inside `executeScan`, add a `timings` array after `errors`:

```typescript
const timings: PluginLoadTiming[] = [];
```

In the `for (const sp of scanned)` loop (line 74-88), wrap the `loadPluginFromSource` call with timing:

```typescript
for (const sp of scanned) {
  const enabled = stateMap.get(sp.id) ?? true;
  if (!enabled) continue;

  const start = performance.now();
  const manifest = loadPluginFromSource(sp.code, sp.id);
  const elapsed = performance.now() - start;

  if (manifest) {
    plugins.push(manifest);
    timings.push({ pluginId: sp.id, pluginName: sp.name, loadTimeMs: elapsed });
  } else {
    errors.push({
      pluginId: sp.id,
      pluginName: sp.name,
      reason: 'Failed to load plugin code',
    });
  }
}
```

Update the return statement (line 110) to include timings:

```typescript
return { plugins, errors, timings };
```

Update the initial state in `createStore` to include `timings: []`.

Update both `init()` and `reload()` to set `timings` from result:

```typescript
set({ plugins: result.plugins, errors: result.errors, timings: result.timings, status: 'ready' });
```

**Step 2: Verify build**

Run: `pnpm --filter @dripnex/desktop typecheck`

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/pluginRuntimeStore.ts
git commit -m "feat(plugins): track load timing per plugin in runtime store"
```

---

### Task 5: Build Plugin Inspector Component

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx`
- Modify: `apps/desktop/src/renderer/pages/settings/sections/Section.module.css`

**Context:** A collapsible "Developer" section at the bottom of the Plugins settings page, shown only when `import.meta.env.DEV` is true. Shows loaded plugins with timing, errors, and a "Force Reload" button.

**Step 1: Add the PluginInspector component**

In `PluginsSection.tsx`, add a new component before the `PluginsSection` function. Import from the runtime store:

```typescript
import { useSyncExternalStore } from 'react';
import { pluginRuntimeStore } from '../../../stores/pluginRuntimeStore';
import type { PluginLoadError, PluginLoadTiming } from '../../../stores/pluginRuntimeStore';
```

Also import the `AlertTriangle` icon from lucide-react:

```typescript
import {
  RefreshCw,
  FolderOpen,
  ChevronDown,
  Download,
  Trash2,
  Search,
  Check,
  AlertTriangle,
} from 'lucide-react';
```

Add the PluginInspector component:

```tsx
function PluginInspector() {
  const [open, setOpen] = useState(false);

  const status = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().status
  );
  const errors = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().errors
  );
  const timings = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().timings
  );
  const pluginCount = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().plugins.length
  );

  const handleForceReload = useCallback(() => {
    window.dripnex.plugins.requestReload();
  }, []);

  return (
    <div className={styles.inspectorPanel}>
      <button
        type="button"
        className={styles.inspectorToggle}
        onClick={() => setOpen(prev => !prev)}
      >
        <ChevronDown
          size={14}
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
          }}
        />
        <span>Developer</span>
        {errors.length > 0 && (
          <span className={styles.inspectorErrorBadge}>
            <AlertTriangle size={12} />
            {errors.length}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.inspectorContent}>
          {/* Status summary */}
          <div className={styles.inspectorRow}>
            <span className={styles.inspectorLabel}>Status</span>
            <span>{status === 'scanning' ? 'Scanning...' : `${pluginCount} loaded`}</span>
          </div>

          {/* Timings table */}
          {timings.length > 0 && (
            <div className={styles.inspectorTimings}>
              <div className={styles.inspectorLabel}>Load times</div>
              <table className={styles.inspectorTable}>
                <thead>
                  <tr>
                    <th>Plugin</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {timings.map(t => (
                    <tr key={t.pluginId}>
                      <td>{t.pluginName}</td>
                      <td>{t.loadTimeMs < 1 ? '<1' : Math.round(t.loadTimeMs)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className={styles.inspectorErrors}>
              <div className={styles.inspectorLabel}>Errors</div>
              {errors.map(err => (
                <div key={err.pluginId} className={styles.inspectorError}>
                  <strong>{err.pluginName}</strong>
                  <span>{err.reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className={styles.actionButton} onClick={handleForceReload}>
              <RefreshCw size={14} />
              <span>Force Reload All</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Render the inspector in PluginsSection**

In the `PluginsSection` function, add the inspector at the bottom, after the `{activeTab === 'browse' && <BrowseTab />}` line (line 701), inside the section div:

```tsx
{
  import.meta.env.DEV && <PluginInspector />;
}
```

**Step 3: Add CSS styles**

In `Section.module.css`, add at the end:

```css
/* Plugin Inspector (dev mode) */
.inspectorPanel {
  margin-top: 2rem;
  border-top: 1px solid var(--border-subtle);
  padding-top: 1rem;
}

.inspectorToggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  padding: 0.25rem 0;
}

.inspectorToggle:hover {
  color: var(--text-secondary);
}

.inspectorErrorBadge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--status-error, #ef4444);
  font-weight: 600;
}

.inspectorContent {
  margin-top: 0.75rem;
  font-size: var(--text-sm);
}

.inspectorRow {
  display: flex;
  justify-content: space-between;
  padding: 0.375rem 0;
  color: var(--text-secondary);
}

.inspectorLabel {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.375rem;
}

.inspectorTimings {
  margin-top: 0.75rem;
}

.inspectorTable {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.inspectorTable th {
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.inspectorTable td {
  padding: 0.25rem 0.5rem;
  color: var(--text-secondary);
}

.inspectorTable td:last-child {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.inspectorErrors {
  margin-top: 0.75rem;
}

.inspectorError {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 0.375rem;
  margin-bottom: 0.375rem;
  font-size: var(--text-sm);
}

.inspectorError strong {
  color: var(--text-primary);
  font-weight: 500;
}

.inspectorError span {
  color: var(--text-muted);
  font-size: var(--text-xs);
}
```

**Step 4: Verify build**

Run: `pnpm --filter @dripnex/desktop typecheck`

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx apps/desktop/src/renderer/pages/settings/sections/Section.module.css
git commit -m "feat(plugins): add dev-mode Plugin Inspector with load timings and error display"
```

---

### Summary

| Task | What                                     | Files                                      |
| ---- | ---------------------------------------- | ------------------------------------------ |
| 1    | Fix pluginScanner type bug               | `pluginScanner.ts`                         |
| 2    | Config value validation function + tests | `validation.ts`, `validation.test.ts`      |
| 3    | Wire validation into PluginsSection      | `PluginsSection.tsx`                       |
| 4    | Load timing in pluginRuntimeStore        | `pluginRuntimeStore.ts`                    |
| 5    | Plugin Inspector component (dev mode)    | `PluginsSection.tsx`, `Section.module.css` |
