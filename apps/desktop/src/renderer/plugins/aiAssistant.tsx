import { useState, useCallback, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import type { PluginManifest, ZoneComponentProps, PluginContext } from '@readied/plugin-api';
import { AiPanel } from '../components/ai/AiPanel';
import '../styles/ai-panel.css';

/**
 * State shared between the plugin activate() and the React components.
 * We use a simple ref-based bridge since the plugin context is not React-aware.
 * Multiple listeners allow both the panel and button to stay in sync.
 */
interface AiBridge {
  context: PluginContext | null;
  visible: boolean;
  listeners: Set<(v: boolean) => void>;
  toggle: () => void;
}

const bridge: AiBridge = {
  context: null,
  visible: false,
  listeners: new Set(),
  toggle() {
    bridge.visible = !bridge.visible;
    bridge.listeners.forEach(fn => fn(bridge.visible));
  },
};

/** Hook to subscribe to bridge visibility state */
function useBridgeVisible(): [boolean, (v: boolean) => void] {
  const [visible, setVisible] = useState(bridge.visible);

  useEffect(() => {
    bridge.listeners.add(setVisible);
    // Sync on mount in case state changed between render and effect
    setVisible(bridge.visible);
    return () => {
      bridge.listeners.delete(setVisible);
    };
  }, []);

  const setBridgeVisible = useCallback((v: boolean) => {
    bridge.visible = v;
    bridge.listeners.forEach(fn => fn(v));
  }, []);

  return [visible, setBridgeVisible];
}

function AiToggleButton() {
  const [visible, setVisible] = useBridgeVisible();

  const handleClick = useCallback(() => {
    setVisible(!visible);
  }, [visible, setVisible]);

  return (
    <button
      type="button"
      className={`note-editor-actions-btn${visible ? ' active' : ''}`}
      onClick={handleClick}
      title="AI Assistant (Cmd+Shift+A)"
      aria-label="Toggle AI Assistant"
    >
      <Sparkles size={18} />
    </button>
  );
}

function AiPanelZone({ meta }: ZoneComponentProps) {
  const ctx = meta?.context as PluginContext | undefined;
  const [visible, setVisible] = useBridgeVisible();

  const handleClose = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const getCurrentNote = useCallback(() => {
    if (!ctx) return null;
    return ctx.app.getCurrentNote();
  }, [ctx]);

  const searchNotes = useCallback(
    async (query: string) => {
      if (!ctx) return [];
      return ctx.app.searchNotes(query);
    },
    [ctx]
  );

  const getNoteById = useCallback(
    async (id: string) => {
      if (!ctx) return null;
      return ctx.app.getNoteById(id);
    },
    [ctx]
  );

  const getConfig = useCallback(
    <T,>(key: string): T | undefined => {
      if (!ctx) return undefined;
      return ctx.config.get<T>(key);
    },
    [ctx]
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      if (!ctx) return;
      ctx.editor.insertAtCursor(text);
      ctx.editor.focus();
    },
    [ctx]
  );

  if (!visible || !ctx) return null;

  return (
    <AiPanel
      onClose={handleClose}
      getCurrentNote={getCurrentNote}
      searchNotes={searchNotes}
      getNoteById={getNoteById}
      getConfig={getConfig}
      insertAtCursor={insertAtCursor}
    />
  );
}

export const aiAssistantPlugin: PluginManifest = {
  id: 'readied-ai-assistant',
  name: 'AI Assistant',
  version: '0.1.0',
  description: 'AI assistant with RAG over your notes, powered by Claude',

  configSchema: {
    apiKey: {
      type: 'string',
      default: '',
      description: 'Your Anthropic API key from console.anthropic.com',
    },
    model: {
      type: 'enum',
      default: 'claude-sonnet-4-5-20250929',
      description: 'Claude model to use',
      options: [
        { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
        { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      ],
    },
    maxContextNotes: {
      type: 'range',
      default: 5,
      description: 'Maximum number of notes to include as context',
      min: 1,
      max: 20,
      step: 1,
    },
  },

  activate(context) {
    bridge.context = context;

    // Register the panel component
    context.layout.addComponent('panel', {
      id: 'ai-assistant:panel',
      component: AiPanelZone,
      order: 50,
      meta: { context },
    });

    // Register the toggle button in editor header actions
    context.layout.addComponent('editor-header-actions', {
      id: 'ai-assistant:toggle-btn',
      component: AiToggleButton,
      order: 10,
    });

    // Toggle command
    const unregisterToggle = context.registerCommand(
      {
        id: 'open-panel',
        name: 'Toggle AI Assistant',
        keybinding: { key: 'A', modifiers: ['Mod', 'Shift'] },
        icon: 'Sparkles',
      },
      () => {
        bridge.toggle();
        return true;
      }
    );

    // Ask about current note command
    const unregisterAsk = context.registerCommand(
      {
        id: 'ask-about-note',
        name: 'Ask AI About Current Note',
        icon: 'MessageSquare',
      },
      () => {
        bridge.visible = true;
        bridge.listeners.forEach(fn => fn(true));
        return true;
      }
    );

    return {
      dispose() {
        bridge.context = null;
        bridge.visible = false;
        bridge.listeners.clear();
        unregisterToggle();
        unregisterAsk();
      },
    };
  },
};
