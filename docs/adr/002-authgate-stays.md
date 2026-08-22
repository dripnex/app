# ADR 002: AuthGate stays

**Status:** Accepted
**Date:** 2026-08-22
**Deciders:** Tomas Maritano

## Context

Dripnex is local-first SQLite. An earlier write-up treated first-run login as a bug ("Inkdrop is offline, so skip the account").

## Decision

Keep AuthGate. Matching Inkdrop official docs:

- [Get started](https://docs.inkdrop.app/start-guide): create account, then "You'll see a login screen."
- [Privacy 5.4](https://docs.inkdrop.app/privacy): account required to use the client apps.

Offline and Don't Sync are **after** login. See #545.

## Consequences

First-run is account + login. Do not ship a guest editor as v1. Mobile, when it exists, uses the same account.
