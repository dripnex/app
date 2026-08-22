# Dripnex MCP

Local stdio server so Claude Code, Cursor, or Grok can search and read
your notes. Prefer Dripnex Local HTTP when the desktop loopback API is
running. Fall back to opening the same SQLite file as the app (WAL) when
the HTTP env is not set.

## Cursor / Grok / Claude Code

Local HTTP (Settings → Integrations → Local HTTP, default port 29168):

```json
{
  "mcpServers": {
    "dripnex": {
      "command": "npx",
      "args": ["tsx", "/ABS/PATH/readide/packages/mcp-server/src/index.ts"],
      "env": {
        "DRIPNEX_LOCAL_SERVER_URL": "http://127.0.0.1:29168",
        "DRIPNEX_LOCAL_TOKEN": "<token from Settings → Integrations → Local HTTP>"
      }
    }
  }
}
```

Copy the real token from the app. Never commit it. Never hardcode it.

SQLite fallback (no Local HTTP):

```json
{
  "mcpServers": {
    "dripnex": {
      "command": "npx",
      "args": ["tsx", "/ABS/PATH/readide/packages/mcp-server/src/index.ts"],
      "env": {
        "DRIPNEX_DB_PATH": "/ABS/PATH/to/dripnex.db"
      }
    }
  }
}
```

Dev DB on this machine:

`~/Library/Application Support/@dripnex/desktop/dripnex.db`

Packaged app DB:

`~/Library/Application Support/Dripnex/dripnex.db`

Requires Node ≥ 22.5.

When `DRIPNEX_LOCAL_SERVER_URL` and `DRIPNEX_LOCAL_TOKEN` are both set,
the server talks Bearer HTTP and does not open SQLite. Setting only one
of the two is an error. The URL must be this machine (`127.0.0.1` or
`localhost`).

## Tools

Read path: `dripnex_status`, `dripnex_search_notes`, `dripnex_read_note`,
`dripnex_list_notes`, `dripnex_list_notebooks`, `dripnex_list_tags`,
`dripnex_list_templates`, `dripnex_get_changes`.

`dripnex_create_note` accepts `template` (title in the Templates notebook).
That copies the template, including `instruction:` frontmatter. Pass `content`
too to keep the instruction and replace the body.

Notebooks map to Local HTTP `/api/books`: `dripnex_create_notebook`,
`dripnex_update_notebook`, `dripnex_delete_notebook`. Tags:
`dripnex_create_tag`, `dripnex_update_tag`.

Writes (`create` / `update` / `trash` / `delete`) are **off by default**.
Enable them in **Settings → Integrations → Allow writes** (writes `mcp.json`
next to the DB). `DRIPNEX_MCP_WRITES=1` still overrides.

Enabling Local HTTP is **not** a write grant. That toggle only starts the
loopback listener. The HTTP API accepts writes with a Bearer token; MCP
tools still check `mcp.json` / `DRIPNEX_MCP_WRITES` first.

`dripnex_trash_note` is a soft delete (`DELETE /api/notes/:id`). Pass
`permanent: true` for a hard delete (`?permanent=1`), matching the desktop
handler.

After a SQLite write the server touches `dripnex.external-write` next to
the DB so the desktop can refetch. HTTP writes go through the desktop, so
that sidecar is not used.

If you pass a notebook name that does not exist, create fails instead of
silently landing in Inbox. Titles use the first non-empty line (same rule
as the app).

Book and tag writes over the SQLite fallback need Local HTTP — the old
SQLite path still covers note create / update / trash.

## Deep audit from notes

Once this server is connected, ask the agent to search `roadmap`,
`debt`, `NOW`, and read those notes before planning work.
