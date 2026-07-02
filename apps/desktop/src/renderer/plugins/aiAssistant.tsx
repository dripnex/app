import { useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import type { PluginManifest } from '@dripnex/plugin-api';
import { DEFAULT_MODEL } from '@dripnex/ai-core';
import '../styles/ai-panel.css';

/**
 * Custom event name used to communicate between the plugin toggle button
 * and App.tsx, avoiding direct imports of the command registry singleton
 * (which pulls in CodeMirror and causes circular‐dep issues at bundle time).
 */
const AI_TOGGLE_EVENT = 'dripnex:ai:toggle-panel';

/**
 * Toggle button for the AI panel rendered in the editor header.
 * Fires a CustomEvent that App.tsx listens for.
 */
function AiToggleButton() {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent(AI_TOGGLE_EVENT));
  }, []);

  return (
    <button
      type="button"
      className="note-editor-actions-btn"
      onClick={handleClick}
      title="AI Assistant (⌘K)"
      aria-label="Toggle AI Assistant"
    >
      <Sparkles size={18} />
    </button>
  );
}

export { AI_TOGGLE_EVENT };

export const aiAssistantPlugin: PluginManifest = {
  id: 'dripnex-ai-assistant',
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
      default: DEFAULT_MODEL,
      description: 'Claude model to use (configure in Settings > AI Assistant instead)',
      options: [
        { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
        { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
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
    // Register the toggle button in editor header actions.
    // The button fires a CustomEvent which App.tsx listens for,
    // so there's a single panel instance and a single source of truth.
    context.layout.addComponent('editor-header-actions', {
      id: 'ai-assistant:toggle-btn',
      component: AiToggleButton,
      order: 10,
    });

    return {
      dispose() {
        // Layout components are cleaned up automatically by PluginHost
      },
    };
  },
};
