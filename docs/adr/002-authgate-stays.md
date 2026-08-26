# ADR 002: AuthGate is the first window

**Status:** Accepted (supersedes the 2026-08-25 “auth is optional” revision)
**Date:** 2026-08-26
**Deciders:** Tomás (product identity)

## Context

ADR 002 (2026-08-25) made auth optional. `App.tsx` stopped importing `AuthGate`.
`resolveAppShell` ignored session. Public copy said the app opened without an account.

That contradicted the 2026-08-26 identity: Dripnex is the hackable AI note taker.
AuthGate is the first window. SQLite is the store. Sync is E2E after account.

Linux AppImage QA used to be blocked by AuthGate. That is an accepted product
decision now. Do not add a bypass flag in production.

## Decision

AuthGate is the first window.

- Cold start without a session → full-window magic-link Sign in / Sign up.
- No guest path. No continue-locally control on the gate.
- Welcome is first-run onboarding **after** account, never instead of account.
- Sync stays optional and end-to-end after login. Encryption/passphrase flows stay.
- Playwright may set `DRIPNEX_E2E=1` so automated tests skip the gate. That is
  not a production bypass.

## Consequences

Human QA cannot reach Settings or plugins without an account. Accepted.
Mobile plans that assumed “same AuthGate as desktop” are correct again.
