# Repo Split Plan — dripnex

> Draft for review with the incoming team (Alicio +). Goal: move from the current
> monorepo to separate repos as collaborators join, **without** creating rework.
> Nothing here is executed yet — we do the in-repo groundwork first, then split
> once ownership boundaries are agreed.

## Why split (and the honest caveat)

Team size alone does **not** require multi-repo (large orgs run monorepos). The
real drivers, which apply as collaborators join:

- **Ownership + access control per repo** — e.g. a backend collaborator sees only
  the API, not the desktop source.
- **Independent release cadence** — the API already deploys on its own (wrangler).
- **Security isolation** / open-sourcing a piece later.

Cost to keep in mind: sharing code across repos means **publishing + versioning**
packages; a shared-type change becomes multi-PR across repos. We mitigate that
with a clean shared package + automated releases (changesets).

## Current layout (one repo, 18 packages + 2 apps)

- `apps/desktop` — Electron app (main / preload / renderer)
- `apps/web` — Next.js marketing site + docs (this is `dripnex.app`)
- `packages/api` — Cloudflare Worker backend (E2E-encrypted; deploys independently)
- **Shared/domain libs** — `core` (domain + contracts), `ai-core`, `sync-core`,
  `storage-core`, `storage-sqlite`, `command-registry`, `commands`, `plugin-api`,
  `wikilinks`, `embeds`, `tasks`, `product-config`, `licensing`
- `packages/mcp-server` — MCP server (agentic surface)

## Candidate repo seams

| Repo                | Contains                                                                                                                                                                                                    | Owner (TBD)          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **dripnex-shared**  | `core`, `sync-core`, `ai-core`, `storage-core`, `command-registry`, `plugin-api`, `wikilinks`, `embeds`, `tasks`, `product-config`, `licensing` — the libs both app + API consume. Published to a registry. | shared               |
| **dripnex-desktop** | `apps/desktop` + desktop-only `storage-sqlite`                                                                                                                                                              | you (app)            |
| **dripnex-api**     | `packages/api` (already independent deploy)                                                                                                                                                                 | backend collaborator |
| **dripnex-web**     | `apps/web` (marketing/docs)                                                                                                                                                                                 | marketing/you        |
| **dripnex-mcp**     | `packages/mcp-server` (optional; could stay with shared)                                                                                                                                                    | agentic              |

## Extraction sequence (non-regretful)

**Phase A — in the monorepo, NOW (identical work for mono or split):**

1. Consolidate shared models into a single source — in progress:
   - ✅ `DEFAULT_MODEL` → `@dripnex/ai-core` (PR #439)
   - ✅ `validateNotebookTree` → `@dripnex/sync-core` (PR #440); resolves the dead-`sync-core`
   - ⏳ `NoteSnapshot` → use `@dripnex/core` canonical (main/preload) — deferred, needs IPC type reconciliation
2. Remove dead/orphan code: formalize or delete `packages/ai-assistant` (no package.json); dedupe `ai-command-types`.
3. Enforce package boundaries (deps lint; `core` pure — no electron/react).
4. Add release tooling for shared packages: **changesets** (versioning + changelog) — even in-repo, this prepares publishing.

**Phase B — when ownership is decided (with Alicio):** 5. Extract `dripnex-shared`: move the shared libs to their own repo, publish to a
private registry (**GitHub Packages** in the `dripnex` org is the low-friction
default). CI publishes on version bump. 6. Point the API + desktop at the published `@dripnex/*` versions instead of
`workspace:*`.

**Phase C:** 7. Extract `dripnex-api` (consumes published shared libs). 8. Extract `dripnex-desktop`. Decide whether `apps/web` moves with it or stands alone.

## Decisions needed (you + Alicio)

- **Ownership**: who owns each repo? (drives the access boundaries — the real reason to split)
- **Registry**: GitHub Packages (recommended, in-org, free) vs npm private.
- **Versioning**: adopt **changesets** for coordinated bumps? (recommended)
- **Web**: stays with desktop or its own repo?
- **MCP**: own repo or part of `dripnex-shared`?
- **`readide` repo name**: keep, or rename the current repo to `dripnex-desktop` when it becomes the app repo?

## Risks

- Shared-type change = publish + bump in each consuming repo (multi-PR). Mitigate: changesets + automated release, and keep the shared API stable.
- Cross-repo refactors are harder — the shared package's public surface should be intentional.
- More CI/infra to maintain per repo.

## Recommendation

Finish **Phase A** in the monorepo now (clean boundaries + a publishable shared
package), decide the seams with Alicio, then execute B/C. Splitting a clean,
well-bounded monorepo is mechanical; splitting a tangled one is painful — so the
groundwork is the investment that makes the split cheap.
