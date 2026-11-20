# ADR 007: The workspace opens without an account

**Status:** Accepted (supersedes ADR 002)
**Date:** 2026-11-19
**Deciders:** Tomás (product identity)

## Context

ADR 002 made AuthGate the first window. A cold start without a session
showed Sign in / Sign up and blocked the notes. That matched an earlier
identity: account, then workspace, then optional sync.

The current identity is local-first. Notes live in SQLite on the machine.
An account exists so cloud sync can encrypt and replicate them. It is not
a ticket to open a file the person already has.

## Decision

The workspace opens without an account.

- Cold start with onboarding unfinished → Welcome, then the workspace.
- Cold start after onboarding → the workspace. No session check, no hydration wait.
- No guest mode and no second local identity. Unsigned is the normal local state.
- Sign-in lives on Enable Sync and Settings → Account. It is how sync starts.
- Sync stays optional and end-to-end. The passphrase still unwraps the CEK
  the server already holds. Dripnex does not store the passphrase.
- Sign-out stops sync and stays in the workspace.
- Playwright does not need a production bypass to open notes.

## Consequences

Human QA can reach the editor, Settings, and plugins without an account.
Cloud sync still requires a magic-link session and the encryption unlock.
Mobile plans that assumed AuthGate on first launch need a separate decision.
