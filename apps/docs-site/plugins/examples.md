# Plugin Examples

Real-world patterns from Readied's built-in plugins.

## Status Bar Plugin

Shows information in the editor status bar. Updates when the document changes.

```typescript
import { useState, useEffect } from 'react';
import type { PluginManifest, ZoneComponentProps, EditorAPI } from '@readied/plugin-api';

function ReadingTime({ meta }: ZoneComponentProps) {
  const editor = meta?.editor as EditorAPI | undefined;
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const words = editor.getWordCount();
      setMinutes(Math.max(1, Math.ceil(words / 200)));
    };
    update();
    return editor.onDocChanged(update);
  }, [editor]);

  if (!editor) return null;
  return <span>{minutes} min read</span>;
}

export const readingTimePlugin: PluginManifest = {
  id: 'reading-time',
  name: 'Reading Time',
  version: '1.0.0',

  activate(context) {
    context.layout.addComponent('editor-status-bar', {
      id: 'reading-time:status',
      component: ReadingTime,
      order: 20,
      meta: { editor: context.editor },
    });

    return {
      dispose() {
        context.layout.removeComponent('reading-time:status');
      },
    };
  },
};
```

## Command-Only Plugin

Registers commands without any UI components.

```typescript
import type { PluginManifest } from '@readied/plugin-api';

export const exportPlugin: PluginManifest = {
  id: 'export-markdown',
  name: 'Export Markdown',
  version: '1.0.0',

  activate(context) {
    const unregister = context.registerCommand(
      {
        id: 'copy-markdown',
        name: 'Copy as Markdown',
        keybinding: { key: 'C', modifiers: ['Mod', 'Shift'] },
        icon: 'Copy',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;
        navigator.clipboard.writeText(content);
        context.log.info('Copied to clipboard');
        return true;
      }
    );

    return { dispose: unregister };
  },
};
```

## Focus Mode Plugin

Adds a CSS class to the editor to dim non-active lines.

```typescript
import type { PluginManifest } from '@readied/plugin-api';

const FOCUS_CLASS = 'my-focus-mode';

// Inject styles once
let injected = false;
function injectStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .${FOCUS_CLASS} .cm-line { opacity: 0.3; transition: opacity 150ms; }
    .${FOCUS_CLASS} .cm-line.cm-activeLine { opacity: 1; }
  `;
  document.head.appendChild(style);
}

export const focusModePlugin: PluginManifest = {
  id: 'focus-mode',
  name: 'Focus Mode',
  version: '1.0.0',

  configSchema: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Enable focus mode on startup',
    },
  },

  activate(context) {
    injectStyles();
    let active = context.config.get<boolean>('enabled') ?? false;

    function apply() {
      const el = document.querySelector('.cm-editor');
      if (!el) return;
      el.classList.toggle(FOCUS_CLASS, active);
    }

    if (active) setTimeout(apply, 100);

    const offNoteSelected = context.app.onNoteSelected(() => {
      setTimeout(apply, 50);
    });

    const unregister = context.registerCommand(
      {
        id: 'toggle',
        name: 'Toggle Focus Mode',
        keybinding: { key: 'F', modifiers: ['Mod', 'Shift'] },
        icon: 'Eye',
      },
      () => {
        active = !active;
        context.config.set('enabled', active);
        apply();
        return true;
      }
    );

    return {
      dispose() {
        active = false;
        apply();
        offNoteSelected();
        unregister();
      },
    };
  },
};
```

## Plugin with Config

Demonstrates using the config schema for user-configurable settings.

```typescript
import type { PluginManifest } from '@readied/plugin-api';

export const plugin: PluginManifest = {
  id: 'my-configurable-plugin',
  name: 'Configurable Plugin',
  version: '1.0.0',

  configSchema: {
    greeting: {
      type: 'string',
      default: 'Hello',
      description: 'Greeting message to show',
    },
    volume: {
      type: 'range',
      default: 50,
      min: 0,
      max: 100,
      step: 10,
      description: 'Notification volume',
    },
    style: {
      type: 'enum',
      default: 'minimal',
      options: [
        { value: 'minimal', label: 'Minimal' },
        { value: 'detailed', label: 'Detailed' },
        { value: 'verbose', label: 'Verbose' },
      ],
      description: 'Display style',
    },
    notifications: {
      type: 'boolean',
      default: true,
      description: 'Show notification popups',
    },
  },

  activate(context) {
    const greeting = context.config.get<string>('greeting') ?? 'Hello';
    context.log.info(`${greeting} from Configurable Plugin!`);

    return { dispose() {} };
  },
};
```

## Panel Plugin with Toggle

Adds a button to the editor header that toggles a side panel.

```typescript
import { useState, useCallback, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import type { PluginManifest, ZoneComponentProps, PluginContext } from '@readied/plugin-api';

// Bridge between plugin context and React components
const bridge = {
  visible: false,
  listeners: new Set<(v: boolean) => void>(),
  toggle() {
    bridge.visible = !bridge.visible;
    bridge.listeners.forEach(fn => fn(bridge.visible));
  },
};

function useBridgeVisible(): [boolean, (v: boolean) => void] {
  const [visible, setVisible] = useState(bridge.visible);

  useEffect(() => {
    bridge.listeners.add(setVisible);
    setVisible(bridge.visible);
    return () => { bridge.listeners.delete(setVisible); };
  }, []);

  const set = useCallback((v: boolean) => {
    bridge.visible = v;
    bridge.listeners.forEach(fn => fn(v));
  }, []);

  return [visible, set];
}

function ToggleButton() {
  const [visible] = useBridgeVisible();
  return (
    <button
      className={`note-editor-actions-btn${visible ? ' active' : ''}`}
      onClick={() => bridge.toggle()}
      title="My Panel"
    >
      <BookOpen size={18} />
    </button>
  );
}

function MyPanel({ meta }: ZoneComponentProps) {
  const [visible] = useBridgeVisible();
  if (!visible) return null;

  return (
    <div style={{ padding: '1rem', borderLeft: '1px solid var(--border)' }}>
      <h3>My Panel</h3>
      <p>Content goes here</p>
    </div>
  );
}

export const plugin: PluginManifest = {
  id: 'my-panel-plugin',
  name: 'Panel Plugin',
  version: '1.0.0',

  activate(context) {
    context.layout.addComponent('editor-header-actions', {
      id: 'my-panel:toggle',
      component: ToggleButton,
      order: 20,
    });

    context.layout.addComponent('panel', {
      id: 'my-panel:panel',
      component: MyPanel,
      order: 50,
      meta: { context },
    });

    const unregister = context.registerCommand(
      { id: 'toggle', name: 'Toggle My Panel', icon: 'BookOpen' },
      () => { bridge.toggle(); return true; }
    );

    return {
      dispose() {
        bridge.visible = false;
        bridge.listeners.clear();
        unregister();
      },
    };
  },
};
```
