import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    // Pre-bundle all CodeMirror packages together to avoid multiple instances of @codemirror/state
    // See: https://codemirror.net/docs/guide/#bundling
    // optimizeDeps only covers the dev server. Production also has to keep
    // @codemirror/* and @lezer/* in one chunk — HighlightStyle.define() in
    // editorTheme.ts reads tags at module init, and a split build leaves
    // them undefined ("tags is not iterable").
    optimizeDeps: {
      include: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lang-markdown',
        '@codemirror/language-data',
        '@lezer/highlight',
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
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        // highlight@1.2.3 nests common@1.5.0; language/markdown nest 1.5.2.
        // Two NodeProp identities → HighlightStyle.style(undefined) →
        // "tags is not iterable". Pin every import to the desktop copy.
        '@lezer/common': resolve(__dirname, 'node_modules/@lezer/common'),
      },
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
