/**
 * Vim Mode Plugin (Stub)
 *
 * Registers a toggle command for Vim keybindings in the CodeMirror editor.
 * Currently a stub — @replit/codemirror-vim or @codemirror/vim is not installed.
 * When the dependency is added in the future, this plugin will register
 * the vim extension via context.registerExtensions().
 *
 * For now it shows a status indicator and logs a message directing the user
 * to install the dependency.
 */

import type { PluginManifest } from '@readied/plugin-api';

function VimStatusIndicator() {
  return <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>VIM</span>;
}

export const vimModePlugin: PluginManifest = {
  id: 'readied-vim-mode',
  name: 'Vim Mode',
  version: '1.0.0',
  description:
    'Optional Vim keybindings for the CodeMirror editor (stub — dependency not yet installed)',

  configSchema: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Enable Vim keybindings in the editor',
    },
  },

  activate(context) {
    let enabled = context.config.get<boolean>('enabled') ?? false;

    const showStatus = () => {
      context.layout.addComponent('editor-status-bar', {
        id: 'vim-mode:status',
        component: VimStatusIndicator,
        order: 5,
        meta: {},
      });
    };

    const hideStatus = () => {
      context.layout.removeComponent('vim-mode:status');
    };

    const enable = () => {
      enabled = true;
      context.config.set('enabled', true);
      // TODO: When @codemirror/vim is installed, register the extension here:
      // unregisterExt = context.registerExtensions('vim-keymap', [vim()]);
      context.log.warn(
        'Vim mode enabled but @codemirror/vim is not installed. ' +
          'Add it to apps/desktop/package.json to activate Vim keybindings.'
      );
      showStatus();
    };

    const disable = () => {
      enabled = false;
      context.config.set('enabled', false);
      hideStatus();
      context.log.info('Vim mode disabled');
    };

    if (enabled) {
      enable();
    }

    const unregisterCommand = context.registerCommand(
      {
        id: 'toggle',
        name: 'Toggle Vim Mode',
        icon: 'Terminal',
      },
      () => {
        if (enabled) {
          disable();
        } else {
          enable();
        }
        return true;
      }
    );

    context.log.info('Vim mode plugin activated (stub)');

    return {
      dispose() {
        hideStatus();
        unregisterCommand();
      },
    };
  },
};
