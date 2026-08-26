# E2E tests (Playwright + Electron)

End-to-end tests for the desktop app, driven through Playwright's `_electron` API. Tests launch the **built** Electron bundle in `out/`, so you must run `pnpm build` (or `pnpm dev` for headed iteration) before they pass.

## Running locally

```bash
# From repo root
pnpm --filter @dripnex/desktop build       # produces out/main/index.js
pnpm --filter @dripnex/desktop e2e         # headless
pnpm --filter @dripnex/desktop e2e:headed  # opens the window
```

First run also downloads Playwright's browser binaries:

```bash
npx playwright install --with-deps
```

(`--with-deps` only matters on Linux, where it installs system libs.)

## Isolation

`launchApp()` in `fixtures.ts` creates a fresh temp `userData` dir per test, so:

- The SQLite DB starts empty every time.
- Settings, license cache, AI keys, etc. don't leak between tests.
- The host's real Dripnex data is never touched.

Set `DRIPNEX_E2E_KEEP_USERDATA=1` to keep the temp dir on failure for post-mortem inspection.

`openFirstNote()` clicks **Create Your First Note** and waits for `.cm-content`. Isolated e2e sets `DRIPNEX_E2E=1` so Playwright can skip AuthGate. That flag is test-only, not a production bypass. Human QA blocked by AuthGate is accepted.

## What we test

| Spec             | What it covers                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts`  | App launches, main window renders, IPC bridge present, no uncaught console errors during initial mount. Opening a note loads CodeMirror without `[CodeMirror] plugin error` (regression for #311).                               |
| `notes.spec.ts`  | Notes IPC contract — create / list / get roundtrip, FTS5 search returns freshly-created notes. Driven through the **preload bridge** (`window.dripnex.notes.*`), not the editor UI, so the contract survives renderer refactors. |
| `editor.spec.ts` | Types into `.cm-content` after creating a note, and Enter on a bullet list (continue-markup). Clicks the last `.cm-line` / uses `keyboard.type` — not `fill()`, which CodeMirror's contenteditable does not accept.              |
| `tables.spec.ts` | Wide GFM table widget stays inside the scroller. **Skipped on CI** (`CI` env) — insert + leave-table decorations are still flaky under xvfb. Run headed locally.                                                                 |

## What we still don't test

- **Slash command / autocomplete UI** and other decoration-heavy editor widgets (table WYSIWYG). Worth a follow-up once those are stable under xvfb.
- **AI panel streaming.** Needs a mock provider and is more useful as a vitest test against `@dripnex/ai-core`.
- **Sync flows.** Need a fake server.

## Packaged vs `out/`

`pnpm e2e` launches `out/`, not an electron-builder asar / `.app`. The historical packaged-only crash (`tags is not iterable` / `[CodeMirror] plugin error`) is documented in [`RELEASES.md`](../RELEASES.md) and issue #311.

`electron.vite.config.ts` keeps `@codemirror/*` and `@lezer/*` in one `codemirror` chunk (`manualChunks` + `resolve.dedupe` + `@lezer/common` pin). A production renderer build on this tree emits a single `codemirror-*.js` with one `@lezer/common@1.5.2` region; the lazy `MarkdownEditor-*.js` chunk **imports** `tags` / `HighlightStyle` from that file instead of bundling a second copy. That is the `out/` case. A signed macOS `.app` is still a manual packaged-checklist item.

## CI

The `e2e` job in `.github/workflows/ci.yml` runs on Linux + xvfb and is **required** (no `continue-on-error`). Failures upload `apps/desktop/playwright-report/`.
