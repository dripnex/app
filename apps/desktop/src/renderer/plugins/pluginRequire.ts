/**
 * Host modules community plugins may `require()`.
 *
 * CodeMirror extensions must share the app's @codemirror/* singleton.
 * React must be the app's copy so layout components can use hooks.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import * as cmCommands from '@codemirror/commands';
import * as cmLanguage from '@codemirror/language';
import * as cmSearch from '@codemirror/search';
import * as cmState from '@codemirror/state';
import * as cmView from '@codemirror/view';
import * as pluginApi from '@dripnex/plugin-api';
import gsap from 'gsap';

function asCjs(mod: object): unknown {
  const rec = mod as Record<string, unknown>;
  if (rec.default === undefined) return { ...rec, default: rec };
  return rec;
}

const HOST_MODULES: Record<string, unknown> = {
  react: asCjs(React),
  'react-dom': asCjs(ReactDOM),
  'react/jsx-runtime': asCjs(jsxRuntime),
  '@codemirror/state': asCjs(cmState),
  '@codemirror/view': asCjs(cmView),
  '@codemirror/language': asCjs(cmLanguage),
  '@codemirror/commands': asCjs(cmCommands),
  '@codemirror/search': asCjs(cmSearch),
  '@dripnex/plugin-api': asCjs(pluginApi),
  gsap: Object.assign(gsap, { default: gsap }),
};

export function createPluginRequire(): (id: string) => unknown {
  return (id: string) => {
    const mod = HOST_MODULES[id];
    if (mod) return mod;
    throw new Error(
      `[plugin] cannot require '${id}'. Bundle it, or use a host-provided module (react, @codemirror/*, @dripnex/plugin-api, gsap).`
    );
  };
}
