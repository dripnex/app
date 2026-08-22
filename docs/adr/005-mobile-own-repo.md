# ADR 005: Mobile is its own repo

**Status:** Accepted
**Date:** 2026-08-22
**Deciders:** Tomas Maritano

## Context

Inkdrop has iOS/Android. Dripnex desktop is the product until write path + sync are proven. Putting UIKit/Swift inside `dripnex/app` (Electron monorepo) couples two release trains.

## Decision

- Do not put mobile in `dripnex/app`.
- Repo `dripnex/ios` (iPhone + iPad). Android later, not the first client.
- Same AuthGate + account as desktop. Same note model. Sync via existing `api.dripnex.app` after login.
- Two-profile desktop sync is a P3 risk, not a P1 blocker. Issue #551. Full plan: [`docs/mobile/PLAN.md`](../mobile/PLAN.md). Contract: [`docs/mobile/CONTRACT.md`](../mobile/CONTRACT.md).

## Consequences

Desktop CI/releases stay Electron-only. iOS has its own repo, signing, and TestFlight. Shared pieces are HTTP contracts and markdown rules, not the Electron shell.

`dripnex/ios` created 2026-08-22 (private). P1 skeleton starts there. iOS copies `NoteSnapshot` + `sync-core` wire fields; see [`docs/mobile/CONTRACT.md`](../mobile/CONTRACT.md).
