import { ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { PluginManifest } from '@dripnex/plugin-api';

/**
 * CM6 extension that scrolls the cursor to the vertical center of the editor.
 * This creates a typewriter-like writing experience.
 */
function typewriterScroll(): Extension {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!update.selectionSet && !update.docChanged) return;

        const view = update.view;
        const head = view.state.selection.main.head;
        const coords = view.coordsAtPos(head);
        if (!coords) return;

        const editorRect = view.dom.getBoundingClientRect();
        const centerY = editorRect.top + editorRect.height / 2;
        const offset = coords.top - centerY;

        // Only scroll if cursor is more than 40px from center
        if (Math.abs(offset) > 40) {
          view.scrollDOM.scrollBy({ top: offset, behavior: 'smooth' });
        }
      }
    }
  );
}

export const typewriterModePlugin: PluginManifest = {
  id: 'dripnex-typewriter-mode',
  name: 'Typewriter Mode',
  version: '1.0.0',
  description: 'Keeps the cursor line centered in the editor for a focused writing experience',

  activate(context) {
    let enabled = context.config.get<boolean>('enabled') ?? false;
    let unregisterExt: (() => void) | null = null;

    const enable = () => {
      if (unregisterExt) return;
      unregisterExt = context.registerExtensions('typewriter-scroll', [typewriterScroll()]);
      context.log.info('Typewriter mode enabled');
    };

    const disable = () => {
      if (!unregisterExt) return;
      unregisterExt();
      unregisterExt = null;
      context.log.info('Typewriter mode disabled');
    };

    // Apply initial state
    if (enabled) {
      enable();
    }

    const unobserve = context.config.observe<boolean>('enabled', value => {
      enabled = Boolean(value);
      if (enabled) enable();
      else disable();
    });

    // Register toggle command
    const unregisterCommand = context.registerCommand(
      {
        id: 'toggle',
        name: 'Toggle Typewriter Mode',
        keybinding: { key: 't', modifiers: ['Mod', 'Shift'] },
        icon: 'AlignCenter',
      },
      () => {
        enabled = !enabled;
        context.config.set('enabled', enabled);
        if (enabled) {
          enable();
        } else {
          disable();
        }
        return true;
      }
    );

    return {
      dispose() {
        unobserve();
        disable();
        unregisterCommand();
      },
    };
  },
};
