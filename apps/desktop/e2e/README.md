# E2E tests (Playwright + Electron)

End-to-end tests for the desktop app, driven through Playwright's `_electron` API. Tests launch the **built** Electron bundle in `out/`, so you must run `pnpm build` (or `pnpm dev` for headed iteration) before they pass.

## Running locally

```bash
# From repo root
pnpm --filter @readied/desktop build       # produces out/main/index.js
pnpm --filter @readied/desktop e2e         # headless
pnpm --filter @readied/desktop e2e:headed  # opens the window
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
- The host's real Readied data is never touched.

Set `READIED_E2E_KEEP_USERDATA=1` to keep the temp dir on failure for post-mortem inspection.

## What we test

| Spec            | What it covers                                                                                                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts` | App launches, main window renders, IPC bridge present, no uncaught console errors during initial mount. This is the regression catch for #266 (editor mount crashes producing blank windows).                                                 |
| `notes.spec.ts` | Notes IPC contract — create / list / get roundtrip, FTS5 search returns freshly-created notes. We deliberately drive the **preload bridge** (`window.readied.notes.*`) rather than the editor UI; selectors churn but the contract is stable. |

## What we deliberately don't test (yet)

- **Editor UI interactions** (typing, formatting, hotkeys). The CodeMirror surface is too prone to flake without per-spec selectors. Worth doing once the editor is split (see PR-G in the audit).
- **AI panel streaming.** Needs a mock provider and is more useful as a vitest test against `@readied/ai-core`.
- **Sync flows.** Need a fake server.

These will be follow-ups once the basics are stable in CI.

## CI

The `e2e` job in `.github/workflows/ci.yml` runs on Linux + xvfb. It starts as `continue-on-error: true` — the goal of this PR is to land the infrastructure, not to gate every PR on E2E green. Once the suite is verified end-to-end on a real CI run, flip the flag off in a follow-up.
