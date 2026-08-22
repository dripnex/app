# ADR 003: SQLite, not CouchDB

**Status:** Accepted
**Date:** 2026-08-22
**Deciders:** Tomas Maritano

## Context

Early Inkdrop posts (2017-18) used CouchDB/PouchDB+Cloudant. Planning CouchDB self-host as "Inkdrop parity" was wrong.

## Decision

Local store is SQLite (Inkdrop v6 replaced LevelDB with SQLite). Dripnex already uses better-sqlite3. Sync docs that mention Advanced CouchDB are leftover. Do not plan CouchDB self-host.

## Consequences

Mobile and MCP read/write the same note model (SQLite on device, optional E2E sync). No second database product.
