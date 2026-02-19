import { useState, useCallback, useEffect } from 'react';
import type { PluginManifest, ZoneComponentProps, PluginContext } from '@readied/plugin-api';
import { AiPanel } from '../components/ai/AiPanel';
import '../styles/ai-panel.css';

/**
 * State shared between the plugin activate() and the React component.
 * We use a simple ref-based bridge since the plugin context is not React-aware.
 */
interface AiBridge {
  context: PluginContext | null;
  visible: boolean;
  setVisible: ((v: boolean) => void) | null;
}

const bridge: AiBridge = {
  context: null,
  visible: false,
  setVisible: null,
};

function AiPanelZone({ meta }: ZoneComponentProps) {
  const ctx = meta?.context as PluginContext | undefined;
  const [visible, setVisible] = useState(bridge.visible);

  // Sync bridge
  useEffect(() => {
    bridge.setVisible = setVisible;
    return () => {
      bridge.setVisible = null;
    };
  }, []);

  // Sync visibility from bridge
  useEffect(() => {
    setVisible(bridge.visible);
  }, []);

  const handleClose = useCallback(() => {
    bridge.visible = false;
    setVisible(false);
  }, []);

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

    // Toggle command
    const unregisterToggle = context.registerCommand(
      {
        id: 'open-panel',
        name: 'Toggle AI Assistant',
        keybinding: { key: 'A', modifiers: ['Mod', 'Shift'] },
        icon: 'Sparkles',
      },
      () => {
        bridge.visible = !bridge.visible;
        bridge.setVisible?.(bridge.visible);
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
        bridge.setVisible?.(true);
        return true;
      }
    );

    return {
      dispose() {
        bridge.context = null;
        bridge.visible = false;
        bridge.setVisible = null;
        unregisterToggle();
        unregisterAsk();
      },
    };
  },
};
