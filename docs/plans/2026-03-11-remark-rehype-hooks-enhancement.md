# Remark/Rehype Hooks Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the existing remark/rehype plugin hook API with error isolation, priority ordering, hot-reload on toggle, and plugin metadata.

**Architecture:** Incremental enhancement of existing stores (`remarkPluginStore`, `rehypePluginStore`) and plugin registration API. Backward-compatible — existing plugins work without changes.

**Tech Stack:** TypeScript, unified/remark/rehype, Zustand, React, CodeMirror 6

---

### Task 1: Define PluginHookOptions type

**Files:**

- Modify: `packages/plugin-api/src/types.ts`

**Step 1: Add the PluginHookOptions interface**

```typescript
/** Options for registering a remark/rehype plugin */
export interface PluginHookOptions {
  /** Display name for debugging (defaults to pluginId) */
  name?: string;
  /** Plugin version for debugging */
  version?: string;
  /** Execution priority — lower runs first. Default: 100 */
  priority?: number;
  /** The plugin ID that registered this hook */
  pluginId?: string;
}
```

**Step 2: Commit**

```bash
git add packages/plugin-api/src/types.ts
git commit -m "feat(plugin-api): add PluginHookOptions type for remark/rehype metadata"
```

---

### Task 2: Create safePluginWrapper

**Files:**

- Create: `packages/plugin-api/src/preview/safePluginWrapper.ts`

**Step 1: Write the wrapper**

The wrapper takes a unified plugin + metadata, returns a new plugin that:

- Wraps the plugin's visitor functions in try/catch
- On error: logs `[PluginPipeline] ${name}@${version} failed on node ${node.type}: ${error.message}`
- On error: injects an error marker node into the AST (a `div` with class `plugin-error-boundary` and data attributes for plugin name + error message)
- On success: returns the transformed node normally

```typescript
import type { Plugin } from 'unified';
import type { PluginHookOptions } from '../types.js';

interface PluginMetadata {
  name: string;
  version: string;
  pluginId: string;
}

/**
 * Wraps a remark/rehype plugin so failures on individual nodes
 * don't crash the entire preview pipeline.
 */
export function safePluginWrapper(plugin: Plugin, metadata: PluginMetadata): Plugin {
  // Return a new plugin function that wraps the original
  // The wrapper intercepts the transformer returned by the plugin
  // and wraps each visit() call in try/catch
  // On error: console.warn + inject error marker node
  // On success: pass through normally
}
```

Key behavior:

- If the plugin itself throws during initialization (not per-node), catch that too and return a no-op transformer
- Error marker node: `{ type: 'html', value: '<div class="plugin-error-block" data-plugin="name" data-error="message">Plugin name failed on this block</div>' }`

**Step 2: Commit**

```bash
git add packages/plugin-api/src/preview/safePluginWrapper.ts
git commit -m "feat(plugin-api): add safePluginWrapper for per-block error isolation"
```

---

### Task 3: Upgrade remarkPluginStore with metadata + priority + safe wrapping

**Files:**

- Modify: `packages/plugin-api/src/preview/remarkPluginStore.ts`

**Step 1: Read current store implementation**

**Step 2: Modify the store**

Changes:

- Internal storage: `{ plugin: Plugin, metadata: PluginMetadata }[]` instead of `Plugin[]`
- `register(plugin, options?)` — accepts optional `PluginHookOptions`, wraps with `safePluginWrapper`, stores with metadata
- `getPlugins()` — returns plugins sorted by `metadata.priority` (ascending), then by registration order
- `unregister(pluginId)` — remove all plugins registered by a given pluginId
- Backward-compatible: `register(plugin)` still works (defaults: priority=100, name='unknown', version='0.0.0')
- Log on register: `console.debug('[RemarkPlugins] Registered: ${name}@${version} (priority: ${priority})')`

**Step 3: Commit**

```bash
git add packages/plugin-api/src/preview/remarkPluginStore.ts
git commit -m "feat(plugin-api): upgrade remarkPluginStore with metadata, priority, and error isolation"
```

---

### Task 4: Upgrade rehypePluginStore (same pattern as Task 3)

**Files:**

- Modify: `packages/plugin-api/src/preview/rehypePluginStore.ts`

**Step 1: Apply same changes as Task 3 to rehypePluginStore**

Same internal storage, same register/getPlugins/unregister API, same safePluginWrapper usage.

**Step 2: Commit**

```bash
git add packages/plugin-api/src/preview/rehypePluginStore.ts
git commit -m "feat(plugin-api): upgrade rehypePluginStore with metadata, priority, and error isolation"
```

---

### Task 5: Update PluginContext registration methods

**Files:**

- Modify: `packages/plugin-api/src/lifecycle/PluginRegistry.ts` (or wherever `registerRemarkPlugin`/`registerRehypePlugin` are created)
- Modify: `packages/plugin-api/src/types.ts` (PluginContext interface if needed)

**Step 1: Read how PluginContext creates registerRemarkPlugin/registerRehypePlugin**

**Step 2: Update the context factory**

- `registerRemarkPlugin(plugin, options?)` — pass `{ ...options, pluginId: manifest.id }` to store
- `registerRehypePlugin(plugin, options?)` — same
- On plugin deactivate: call `remarkPluginStore.unregister(pluginId)` and `rehypePluginStore.unregister(pluginId)`

**Step 3: Commit**

```bash
git add packages/plugin-api/src/lifecycle/PluginRegistry.ts packages/plugin-api/src/types.ts
git commit -m "feat(plugin-api): pass metadata through PluginContext registration and cleanup on deactivate"
```

---

### Task 6: Add error block CSS to MarkdownPreview

**Files:**

- Modify: `apps/desktop/src/renderer/components/editor/MarkdownPreview.tsx` (or its CSS)

**Step 1: Add CSS for `.plugin-error-block`**

```css
.plugin-error-block {
  background: rgba(239, 68, 68, 0.08);
  border-left: 3px solid #ef4444;
  padding: 4px 8px;
  margin: 4px 0;
  font-size: 0.75rem;
  color: #ef4444;
  border-radius: 2px;
  font-family: monospace;
}
```

Subtle, non-intrusive, matches the app's aesthetic.

**Step 2: Commit**

```bash
git add apps/desktop/src/renderer/components/editor/MarkdownPreview.tsx
git commit -m "feat(desktop): add CSS for plugin error block boundaries in preview"
```

---

### Task 7: Hot-reload — auto-reload on plugin toggle

**Files:**

- Modify: `apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx`
- Modify: `apps/desktop/src/renderer/stores/pluginRuntimeStore.ts`

**Step 1: Read current toggle handler in PluginsSection.tsx**

**Step 2: Add togglePlugin method to pluginRuntimeStore**

```typescript
togglePlugin: async (pluginId: string, enabled: boolean) => {
  await window.readied.plugins.setEnabled(pluginId, enabled);
  // Selective reload: deactivate or activate just this plugin
  if (!enabled) {
    pluginRegistry.deactivate(pluginId);
    remarkPluginStore.unregister(pluginId);
    rehypePluginStore.unregister(pluginId);
  } else {
    // Re-scan and load just this plugin
    await get().reloadPlugins();
  }
};
```

**Step 3: Update PluginsSection toggle handler**

Replace the current `setEnabled` call with `pluginRuntimeStore.getState().togglePlugin(pluginId, enabled)`.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/stores/pluginRuntimeStore.ts apps/desktop/src/renderer/pages/settings/sections/PluginsSection.tsx
git commit -m "feat(desktop): hot-reload preview when toggling plugins on/off"
```

---

### Task 8: Update built-in plugins to use metadata

**Files:**

- Modify: `apps/desktop/src/renderer/plugins/` (any built-in that registers remark/rehype hooks)

**Step 1: Identify which built-in plugins register remark/rehype hooks**

**Step 2: Add metadata to their registrations**

```typescript
// Before
context.registerRemarkPlugin(remarkGfm);

// After
context.registerRemarkPlugin(remarkGfm, {
  name: 'remark-gfm',
  priority: 5,
});
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/plugins/
git commit -m "feat(desktop): add metadata to built-in plugin remark/rehype registrations"
```

---

### Task 9: Verify end-to-end

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

**Step 2: Run tests**

```bash
pnpm test
```

**Step 3: Manual verification**

- Open dev mode (`pnpm dev`)
- Open a note with markdown content
- Go to Settings > Plugins, toggle a plugin off → preview updates immediately
- Toggle it back on → preview updates
- If a plugin has an intentional error → verify per-block fallback appears

**Step 4: Final commit if any fixes needed**
