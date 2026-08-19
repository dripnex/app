import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// pnpm nests mermaid deps next to the mermaid package, not under desktop/.
const mermaidNodeModules = dirname(
  dirname(realpathSync(resolve(__dirname, 'node_modules/mermaid/package.json')))
);
const dayjsRoot = resolve(mermaidNodeModules, 'dayjs');

/** mermaid does `import dayjs from "dayjs"`. dayjs' package main is CJS
 * (`dayjs.min.js`) with no ESM default. Alias on the bare specifier is not
 * enough — Vite may already have resolved it to dayjs.min.js. */
function dayjsEsm(): Plugin {
  return {
    name: 'dayjs-esm',
    enforce: 'pre',
    resolveId(source) {
      const bare = source.split('?')[0] ?? source;
      if (bare === 'dayjs' || bare.endsWith('/dayjs.min.js') || bare.endsWith('/dayjs.js')) {
        return resolve(dayjsRoot, 'esm/index.js');
      }
      const plugin = bare.match(/(?:^|\/)dayjs\/plugin\/([^/]+?)(?:\.js)?$/);
      if (plugin?.[1]) {
        return resolve(dayjsRoot, `esm/plugin/${plugin[1]}/index.js`);
      }
      return null;
    },
  };
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    // Bind IPv4 on a port Docker/other Vite apps do not steal.
    // Vite 8 defaults to [::1]; Electron loading 127.0.0.1 then
    // lands on chrome-error:// and the window stays black.
    // 5173 is often Docker. Do not hop — ELECTRON_RENDERER_URL
    // and the live server must stay on the same origin.
    server: {
      host: '127.0.0.1',
      port: 5180,
      strictPort: true,
      // Electron caches @fs modules as immutable. A stale dayjs.min.js
      // then keeps failing after the resolver change.
      headers: {
        'Cache-Control': 'no-store',
      },
    },
    plugins: [dayjsEsm(), react()],
    // Pre-bundle all CodeMirror packages together to avoid multiple instances of @codemirror/state
    // See: https://codemirror.net/docs/guide/#bundling
    // optimizeDeps only covers the dev server. Production also has to keep
    // @codemirror/* and @lezer/* in one chunk — HighlightStyle.define() in
    // editorTheme.ts reads tags at module init, and a split build leaves
    // them undefined ("tags is not iterable").
    optimizeDeps: {
      // mermaid.core pulls CJS packages (dayjs, sanitize-url, …) with named
      // ESM imports. Serving those raw fails in Electron. Prebundle mermaid
      // so Vite wraps them. Must be in `include` from server start — a
      // late discover 504s the dynamic import and Electron does not reload.
      exclude: ['@dripnex/plugin-api'],
      include: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lang-markdown',
        '@codemirror/language-data',
        '@lezer/highlight',
        'mermaid',
        'dayjs',
      ],
    },
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
        output: {
          // Function form is the #311 acceptance criterion. Keep
          // @codemirror/* and @lezer/* in one chunk so HighlightStyle
          // and tags initialize together.
          manualChunks(id: string) {
            if (id.includes('@codemirror/') || id.includes('@lezer/')) {
              return 'codemirror';
            }
          },
        },
      },
    },
    resolve: {
      alias: [
        { find: '@', replacement: resolve(__dirname, 'src/renderer') },
        {
          find: '@dripnex/tables',
          replacement: resolve(__dirname, '../../packages/tables/src/index.ts'),
        },
        // highlight@1.2.3 nests common@1.5.0; language/markdown nest 1.5.2.
        // Two NodeProp identities → HighlightStyle.style(undefined) →
        // "tags is not iterable". Pin every import to the desktop copy.
        {
          find: '@lezer/common',
          replacement: resolve(__dirname, 'node_modules/@lezer/common'),
        },
        // dayjs is CJS (`dayjs.min.js`). mermaid does `import dayjs from
        // "dayjs"` — without the ESM build that has no default export.
        { find: /^dayjs$/, replacement: resolve(dayjsRoot, 'esm/index.js') },
        {
          find: /^dayjs\/plugin\/(.+)\.js$/,
          replacement: resolve(dayjsRoot, 'esm/plugin/$1/index.js'),
        },
      ],
      dedupe: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/language',
        '@lezer/highlight',
        '@lezer/common',
      ],
    },
  },
});
