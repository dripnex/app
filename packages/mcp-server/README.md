# Dripnex MCP

Local stdio server so Claude Code (or any MCP client) can search and read
your notes. It opens the same SQLite file as the desktop app (WAL).

## Claude Code / Grok / Cursor

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

## Tools

Read path (the product): `dripnex_search_notes`, `dripnex_read_note`,
`dripnex_list_notes`, `dripnex_list_notebooks`, `dripnex_list_tags`,
`dripnex_list_templates`.

`dripnex_create_note` accepts `template` (title in the Templates notebook).
That copies the template, including `instruction:` frontmatter. Pass `content`
too to keep the instruction and replace the body.

Writes (`create` / `update` / `trash`) are **off by default**. Enable them
in **Settings → Integrations → Allow writes** (writes `mcp.json` next to
the DB). `DRIPNEX_MCP_WRITES=1` still overrides. After a write the server
touches `dripnex.external-write` next to the DB so the desktop can refetch.

If you pass a notebook name that does not exist, create fails instead of
silently landing in Inbox. Titles use the first non-empty line (same rule
as the app).

## Deep audit from notes

Once this server is connected, ask the agent to search `roadmap`,
`debt`, `NOW`, and read those notes before planning work.
