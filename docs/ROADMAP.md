# Dripnex Roadmap

Living board: [`docs/NOW.md`](./NOW.md). That file (and the in-app note `dripnex-now`) is what to plan from.

Desktop is the product until it is complete. Mobile waits.

## Now

- Account required. Magic link. Optional E2E sync (`api.dripnex.app`).
- Local SQLite. FTS5. Templates notebook. Soft-delete trash.
- Built-in plugins: Mermaid, Vim, KaTeX (`$…$` / `$$…$$` / fences).
- MCP read-only unless `DRIPNEX_MCP_WRITES=1`.

## Next (order)

1. You: encryption passphrase (footer Set up) so Sync Retry works.
2. You: apex DNS — delete parking A/AAAA so `dripnex.app` is Pages.
3. Keep desktop functional: sync once the CEK exists, refetch after external DB writes, FIX_PLAN leftovers.
4. Then — not before — RAG/embeddings, plugin marketplace, clipper, collab, mobile.

## Not v1

- Mobile as launch
- Plugin marketplace
- Web clipper
- Collaboration
- RAG in the Cloudflare Worker (sync store is ciphertext)

## Historical phases

Older sections that talked about “no account / no sync / no plugins” were frozen around v0.5 (March 2026) and are wrong. Do not resurrect them as a plan.
