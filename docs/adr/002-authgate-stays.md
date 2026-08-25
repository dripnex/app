# ADR 002: Auth is optional (AuthGate is not a launch gate)

**Status:** Accepted (supersedes the 2026-08-22 “AuthGate stays / match Inkdrop” decision)
**Date:** 2026-08-25
**Deciders:** Product constraint (offline-first)

## Context

An earlier revision of this ADR required account + magic-link before the editor,
matching Inkdrop’s login screen. That shipped as a full-window `AuthGate` in
`App.tsx` when `!isAuthenticated`. Playwright skipped it with `DRIPNEX_E2E=1`.
“Continue locally” appeared only after a magic-link request failed, and it
required an email.

Linux AppImage 0.19.0 QA could not reach the workspace or Settings → Plugins:
File was Quit-only, `Ctrl+,` is ignored while the email field is focused, and
there was no skip.

Public product copy: “No account to open a file. Sync is optional, end-to-end,
and never the source of truth.”

## Decision

Do **not** block the workspace, Welcome, Settings, or plugins on a session.

- Cold start without credentials → Welcome (first run) or the local workspace.
- Magic link remains for **optional sync** (Enable Sync, Settings → Account).
- `continueLocally` remains an offline identity helper for sync setup, not a
  ticket to use the app.

Do not reintroduce a hard AuthGate in `apps/desktop/src/renderer/App.tsx`.

## Consequences

Unsigned users get local SQLite notes. Sync/account is opt-in. Mobile plans
that assumed “same AuthGate as desktop” should treat desktop as local-first
with optional account, not account-then-editor.
