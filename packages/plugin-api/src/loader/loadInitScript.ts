import type { PluginContext, PluginManifest } from '../types';
import { assertValidManifest } from '../validation';
import { createInitApi, USER_INIT_ID } from './createInitApi';

/**
 * Evaluate a user init.js script and return a validated PluginManifest.
 *
 * Two formats are accepted:
 *
 * 1. CommonJS PluginManifest (existing):
 *    ```js
 *    module.exports = {
 *      id: 'my-init',
 *      name: 'My Init Script',
 *      version: '1.0.0',
 *      activate(ctx) { ... },
 *    };
 *    ```
 *
 * 2. Free-form script (Inkdrop-style). The file is wrapped as plugin
 *    `user-init` and runs at activate time with a `dripnex` global:
 *    ```js
 *    dripnex.commands.add('paste-as-link', 'Paste as Link', () => {
 *      const { from, to } = dripnex.editor.getSelection();
 *      const text = dripnex.editor.getContent().slice(from, to);
 *      dripnex.editor.replaceRange(from, to, '[' + text + '](url)');
 *    });
 *    ```
 *
 * Returns a validated PluginManifest or null on failure.
 */
function looksLikeCjsSource(code: string): boolean {
  return /module\s*\.\s*exports\s*=/.test(code) || /exports\.\w+\s*=/.test(code);
}

export function loadInitScript(code: string): PluginManifest | null {
  // Default init.js is free-form (`dripnex.menu.add`). Do not probe-eval it:
  // `dripnex` is window.dripnex (preload) and has no .menu.
  if (!looksLikeCjsSource(code)) {
    return wrapFreeForm(code);
  }

  try {
    const module = { exports: {} as Record<string, unknown> };
    const fn = new Function('module', 'exports', 'dripnex', code);
    fn(module, module.exports, undefined);

    if (looksLikeManifest(module.exports)) {
      return assertValidManifest(module.exports, msg => console.warn(`[init.js] ${msg}`));
    }

    return wrapFreeForm(code);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('[init.js] Failed to evaluate user init script:', error);
      return null;
    }
    return wrapFreeForm(code);
  }
}

function looksLikeManifest(exports: unknown): boolean {
  if (exports == null || typeof exports !== 'object' || Array.isArray(exports)) return false;
  const e = exports as Record<string, unknown>;
  return 'id' in e || 'activate' in e || 'name' in e || 'version' in e;
}

function wrapFreeForm(code: string): PluginManifest {
  return {
    id: USER_INIT_ID,
    name: 'init.js',
    version: '1.0.0',
    description: 'Your init.js',
    activate(ctx: PluginContext) {
      const dripnex = createInitApi(ctx);
      const run = new Function('module', 'exports', 'dripnex', code);
      run({ exports: {} }, {}, dripnex);
    },
  };
}
