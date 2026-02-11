import type { PluginManifest } from '@readied/plugin-api';

/**
 * Active Line Highlight — built-in plugin #3
 *
 * Proves: decorations API, editor events, app events, config persistence.
 * Highlights the line at the cursor position using context.decorations.addLineHighlight().
 * Updates on selection change, clears on note switch.
 */
export const activeLineHighlightPlugin: PluginManifest = {
  id: 'readied-active-line',
  name: 'Active Line Highlight',
  version: '1.0.0',
  description: 'Highlights the line where the cursor is positioned',

  activate(context) {
    let enabled = context.config.get<boolean>('enabled') ?? true;
    let removeHighlight: (() => void) | null = null;

    function applyHighlight() {
      if (!enabled) return;

      // Remove previous highlight
      removeHighlight?.();
      removeHighlight = null;

      const sel = context.editor.getSelection();
      const content = context.editor.getContent();
      if (!content) return;

      // Find which line the cursor (head = sel.to) is on (1-indexed)
      const head = sel.to;
      let line = 1;
      for (let i = 0; i < head && i < content.length; i++) {
        if (content[i] === '\n') line++;
      }

      removeHighlight = context.decorations.addLineHighlight(line, 'cm-active-line-plugin');
    }

    function clearHighlight() {
      removeHighlight?.();
      removeHighlight = null;
    }

    // Apply on cursor move
    const offSelection = context.editor.onSelectionChanged(() => {
      applyHighlight();
    });

    // Re-apply when a different note is selected
    const offNoteSelected = context.app.onNoteSelected(note => {
      clearHighlight();
      // Slight delay — editor content updates async after note selection
      if (note && enabled) {
        setTimeout(() => applyHighlight(), 50);
      }
    });

    // Apply initial highlight
    if (enabled) {
      applyHighlight();
    }

    // Toggle command
    const unregisterCommand = context.registerCommand(
      {
        id: 'toggle',
        name: 'Toggle Active Line Highlight',
        icon: 'Highlighter',
      },
      () => {
        enabled = !enabled;
        context.config.set('enabled', enabled);
        if (enabled) {
          applyHighlight();
        } else {
          clearHighlight();
        }
        context.log.info(
          enabled ? 'Active line highlight enabled' : 'Active line highlight disabled'
        );
        return true;
      }
    );

    return {
      dispose() {
        clearHighlight();
        offSelection();
        offNoteSelected();
        unregisterCommand();
      },
    };
  },
};
