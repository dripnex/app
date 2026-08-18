/**
 * Vim keybindings for the CodeMirror editor — Inkdrop-vim shaped.
 *
 * Built on `@replit/codemirror-vim`, plus Ex (`:w` `:n` `:preview` `:cmd`),
 * relativenumber, unnamed clipboard, live mode in the status bar, and
 * `dripnex.vim` for init.js (`Vim.map` / `Vim.defineEx`).
 */

import { vim, Vim } from '@replit/codemirror-vim';
import type { Extension } from '@codemirror/state';
import type { PluginManifest } from '@dripnex/plugin-api';
import { setHostVim } from '@dripnex/plugin-api';
import { registerVimExCommands } from './vim/ex';
import { relativeLineNumbers } from './vim/relativeLineNumbers';
import {
  installUnnamedClipboard,
  clipboardOnFocus,
  syncClipboardIntoUnnamed,
  type ClipboardHost,
} from './vim/clipboard';
import { bindPreviewVimKeys } from './vim/previewScroll';
import { VimStatusIndicator, vimStatusListener, setVimStatusMode } from './vim/status';

setHostVim(Vim);
registerVimExCommands();

export const vimModePlugin: PluginManifest = {
  id: 'dripnex-vim-mode',
  name: 'Vim Mode',
  version: '1.2.0',
  description: 'Vim keybindings, Ex commands, relative line numbers, and system clipboard yank',

  configSchema: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Enable Vim keybindings in the editor',
    },
    relativeLineNumbers: {
      type: 'boolean',
      default: false,
      description: 'Show relative line numbers (current line stays absolute)',
    },
    useSystemClipboard: {
      type: 'boolean',
      default: true,
      description: 'Sync yank/delete with the system clipboard (clipboard=unnamed)',
    },
  },

  activate(context) {
    let enabled = context.config.get<boolean>('enabled') ?? false;
    let unregisterExt: (() => void) | null = null;
    let unregisterLines: (() => void) | null = null;
    let unbindPreview: (() => void) | null = null;

    const clipboardHost: ClipboardHost = {
      isEnabled: () => context.config.get<boolean>('useSystemClipboard') ?? true,
      readText: () => context.clipboard.readText(),
      writeText: text => context.clipboard.writeText(text),
    };

    installUnnamedClipboard(clipboardHost);

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

    const syncRelativeNumbers = () => {
      const want = enabled && (context.config.get<boolean>('relativeLineNumbers') ?? false);
      if (want && !unregisterLines) {
        unregisterLines = context.registerExtensions('vim-relativenumber', [relativeLineNumbers]);
      } else if (!want && unregisterLines) {
        unregisterLines();
        unregisterLines = null;
      }
    };

    const enable = () => {
      if (unregisterExt) return;
      enabled = true;
      context.config.set('enabled', true);
      const extensions: Extension[] = [vim(), clipboardOnFocus(clipboardHost), vimStatusListener()];
      unregisterExt = context.registerExtensions('vim-keymap', extensions);
      unbindPreview = bindPreviewVimKeys();
      showStatus();
      setVimStatusMode('NORMAL');
      syncRelativeNumbers();
      syncClipboardIntoUnnamed(clipboardHost);
      context.log.info('Vim mode enabled');
    };

    const disable = (persist = true) => {
      enabled = false;
      if (persist) context.config.set('enabled', false);
      if (unregisterExt) {
        unregisterExt();
        unregisterExt = null;
      }
      if (unbindPreview) {
        unbindPreview();
        unbindPreview = null;
      }
      syncRelativeNumbers();
      hideStatus();
      context.log.info('Vim mode disabled');
    };

    if (enabled) enable();

    const unobserveEnabled = context.config.observe<boolean>('enabled', value => {
      if (value) enable();
      else disable(false);
    });
    const unobserveLines = context.config.observe('relativeLineNumbers', () => {
      syncRelativeNumbers();
    });

    const unregisters = [
      context.registerCommand(
        {
          id: 'toggle',
          name: 'Toggle Vim Mode',
          icon: 'Terminal',
        },
        () => {
          if (enabled) disable(true);
          else enable();
          return true;
        }
      ),
      context.registerCommand(
        {
          id: 'toggle-relative-numbers',
          name: 'Toggle Vim Relative Line Numbers',
          icon: 'Hash',
        },
        () => {
          const next = !(context.config.get<boolean>('relativeLineNumbers') ?? false);
          context.config.set('relativeLineNumbers', next);
          syncRelativeNumbers();
          return true;
        }
      ),
    ];

    return {
      dispose() {
        unobserveEnabled();
        unobserveLines();
        disable(false);
        for (const unregister of unregisters) unregister();
      },
    };
  },
};
