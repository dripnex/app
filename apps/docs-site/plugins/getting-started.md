# Plugin Development

Readied supports a plugin system that lets you extend the editor with custom functionality. Plugins can add commands, UI components, editor extensions, and more.

## Quick Start

### 1. Scaffold a new plugin

```bash
npx readied-plugin init "My Plugin"
cd my-plugin
npm install
```

This creates a plugin project with TypeScript, the plugin API types, and a starter template.

### 2. Write your plugin

Edit `src/index.ts`:

```typescript
import type { PluginManifest } from '@readied/plugin-api';

export const plugin: PluginManifest = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '0.1.0',
  description: 'Does something useful',

  activate(context) {
    // Register a command in the command palette
    const unregister = context.registerCommand(
      {
        id: 'hello',
        name: 'Say Hello',
        icon: 'Smile',
      },
      () => {
        context.log.info('Hello from My Plugin!');
        return true;
      }
    );

    // Clean up when the plugin is deactivated
    return {
      dispose() {
        unregister();
      },
    };
  },
};
```

### 3. Build and install

```bash
npm run build
```

Copy the output to your Readied plugins directory:

- **macOS:** `~/Library/Application Support/Readied/plugins/my-plugin/`
- **Windows:** `%APPDATA%/Readied/plugins/my-plugin/`
- **Linux:** `~/.config/Readied/plugins/my-plugin/`

### 4. Reload Readied

The plugin will be discovered and loaded automatically on next launch. Toggle it in **Settings > Plugins**.

## Plugin Contract

Readied plugins must follow five rules to maintain the offline-first, markdown-portable principle:

1. **Removable without breaking `.md` files** — Your plugin can be uninstalled and all notes remain valid markdown.
2. **No new syntax** — Don't invent markdown extensions that other editors can't read.
3. **No automatic content mutation** — Never modify the user's markdown without explicit action.
4. **Not required to interpret text** — Notes must be readable without your plugin.
5. **No inter-note dependencies** — Don't create relationships that break if notes are moved or deleted.

## Plugin Lifecycle

```
load → activate(context) → [user interacts] → dispose()
```

1. **Load** — Readied discovers your plugin and reads `manifest.json`
2. **Activate** — Your `activate()` function receives a `PluginContext` with the full API
3. **Running** — Your plugin responds to commands, events, and editor changes
4. **Dispose** — When disabled or on app exit, your `dispose()` function cleans up

::: tip Always clean up
Return a `{ dispose() }` object from `activate()`. Unregister all commands, remove all UI components, and clear any subscriptions.
:::

## Next Steps

- [API Reference](/plugins/api-reference) — Full documentation of every method and type
- [Layout Zones](/plugins/layout-zones) — Where to place UI components
- [Examples](/plugins/examples) — Real-world plugin patterns
