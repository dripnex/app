import type { PluginManifest } from '@dripnex/plugin-api';

/**
 * Focus Mode — built-in plugin
 *
 * Dims all content except the current paragraph by adding a CSS class
 * to the editor container. Toggle via command palette or keybinding.
 */

const FOCUS_CLASS = 'dripnex-focus-mode';

// Inject global styles for focus mode (once)
let styleInjected = false;
function injectFocusModeStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .${FOCUS_CLASS} .cm-line {
      opacity: 0.3;
      transition: opacity 150ms ease;
    }
    .${FOCUS_CLASS} .cm-line.cm-activeLine {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

export const focusModePlugin: PluginManifest = {
  id: 'dripnex-focus-mode',
  name: 'Focus Mode',
  version: '1.0.0',
  description: 'Dims all content except the current paragraph for focused writing',

  configSchema: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Enable focus mode on startup',
    },
  },

  activate(context) {
    injectFocusModeStyles();

    let active = context.config.get<boolean>('enabled') ?? false;

    function applyFocusMode() {
      const editorEl = document.querySelector('.cm-editor');
      if (!editorEl) return;
      if (active) {
        editorEl.classList.add(FOCUS_CLASS);
      } else {
        editorEl.classList.remove(FOCUS_CLASS);
      }
    }

    // Apply on note selection change
    const offNoteSelected = context.app.onNoteSelected(() => {
      setTimeout(applyFocusMode, 50);
    });

    // Apply initially
    if (active) {
      setTimeout(applyFocusMode, 100);
    }

    const unregisterCommand = context.registerCommand(
      {
        id: 'toggle',
        name: 'Toggle Focus Mode',
        keybinding: { key: 'F', modifiers: ['Mod', 'Shift'] },
        icon: 'Eye',
      },
      () => {
        active = !active;
        context.config.set('enabled', active);
        applyFocusMode();
        context.log.info(active ? 'Focus mode enabled' : 'Focus mode disabled');
        return true;
      }
    );

    return {
      dispose() {
        active = false;
        applyFocusMode();
        offNoteSelected();
        unregisterCommand();
      },
    };
  },
};
