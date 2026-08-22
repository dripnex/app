# ADR 004: MCP over Local HTTP

**Status:** Accepted
**Date:** 2026-08-22
**Deciders:** Tomas Maritano

## Context

`packages/mcp-server` opened the SQLite file via `DRIPNEX_DB_PATH`. The desktop already has a loopback API (Settings > Integrations, default `127.0.0.1:29168`, Bearer). Settings snippets still copied the SQLite path.

## Decision

One MCP for every agent (Grok Bot, Claude, Cursor, Codex). Prefer Local HTTP:

- `DRIPNEX_LOCAL_SERVER_URL` + `DRIPNEX_LOCAL_TOKEN`
- URL must be loopback
- SQLite path is fallback when HTTP env is unset
- Writes stay a separate toggle (`mcp.json` / `DRIPNEX_MCP_WRITES`). Enabling MCP/HTTP is not a write grant.
- Never commit the token. Rotate if it was pasted in chat.

Settings Claude/Codex snippets copy URL+token when MCP/HTTP is on. See PR 554.

## Consequences

Agents talk to the running app, not a second writer on the DB file. Clipper and Raycast can use the same HTTP. Grok Bot cannot attach that loopback as a hosted connector (127.0.0.1 is the user's machine).
