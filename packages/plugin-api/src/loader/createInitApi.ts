import type { PluginContext } from '../types';
import type { PluginCommandOptions } from '../types';
import { dispatchHostCommand, getHostVim } from './hostBridges';

export const USER_INIT_ID = 'user-init';

type CommandExecute = (
  payload?: Record<string, unknown>
) => boolean | void | Promise<boolean | void>;

/**
 * Inkdrop-style surface for init.js.
 *
 * Free-form scripts receive this as `dripnex` and can register commands
 * without exporting a PluginManifest.
 */
export interface InitApi {
  editor: PluginContext['editor'];
  app: PluginContext['app'];
  data: PluginContext['data'];
  log: PluginContext['log'];
  config: PluginContext['config'];
  layout: PluginContext['layout'];
  decorations: PluginContext['decorations'];
  commands: {
    add(
      id: string,
      name: string,
      execute: CommandExecute,
      options?: Omit<PluginCommandOptions, 'id' | 'name'>
    ): () => void;
    dispatch(id: string, payload?: Record<string, unknown>): Promise<boolean>;
  };
  /**
   * `@replit/codemirror-vim` `Vim` object when the Vim plugin is loaded.
   * Use `Vim.map` / `Vim.defineEx` from init.js (Inkdrop-style).
   */
  vim: unknown;
  menu: PluginContext['menu'];
  clipboard: PluginContext['clipboard'];
  notifications: PluginContext['notifications'];
  contextMenu: PluginContext['contextMenu'];
  preview: PluginContext['preview'];
  components: PluginContext['components'];
  markdownRenderer: PluginContext['markdownRenderer'];
  registerCommand: PluginContext['registerCommand'];
  registerExtensions: PluginContext['registerExtensions'];
  registerAiCommand: PluginContext['registerAiCommand'];
  registerCssVariables: PluginContext['registerCssVariables'];
  registerTheme: PluginContext['registerTheme'];
  registerRemarkPlugin: PluginContext['registerRemarkPlugin'];
  registerRehypePlugin: PluginContext['registerRehypePlugin'];
  registerPreviewComponent: PluginContext['registerPreviewComponent'];
  registerCodeBlockRenderer: PluginContext['registerCodeBlockRenderer'];
  getActiveEditor(): { editor: PluginContext['editor'] };
}

export function createInitApi(ctx: PluginContext): InitApi {
  return {
    editor: ctx.editor,
    app: ctx.app,
    data: ctx.data,
    log: ctx.log,
    config: ctx.config,
    layout: ctx.layout,
    decorations: ctx.decorations,
    commands: {
      add(id, name, execute, options) {
        return ctx.registerCommand({ id, name, ...options }, execute);
      },
      dispatch(id, payload) {
        return dispatchHostCommand(id, payload);
      },
    },
    get vim() {
      return getHostVim();
    },
    menu: ctx.menu,
    clipboard: ctx.clipboard,
    notifications: ctx.notifications,
    contextMenu: ctx.contextMenu,
    preview: ctx.preview,
    components: ctx.components,
    markdownRenderer: ctx.markdownRenderer,
    registerCommand: ctx.registerCommand,
    registerExtensions: ctx.registerExtensions,
    registerAiCommand: ctx.registerAiCommand,
    registerCssVariables: ctx.registerCssVariables,
    registerTheme: ctx.registerTheme,
    registerRemarkPlugin: ctx.registerRemarkPlugin,
    registerRehypePlugin: ctx.registerRehypePlugin,
    registerPreviewComponent: ctx.registerPreviewComponent,
    registerCodeBlockRenderer: ctx.registerCodeBlockRenderer,
    getActiveEditor() {
      return { editor: ctx.editor };
    },
  };
}
