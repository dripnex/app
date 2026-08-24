# Dripnex — Scope Reconciliation (Vision ↔ Issues ↔ Code)

> **Status:** Living decision doc. Last reconciled against the open GitHub issue tree
> (E1–E18, 116 issues) and the working code at `v0.15.2`.
>
> **Source-of-truth hierarchy:** running code > GitHub issues (the real roadmap) >
> this doc > the "Agentic Software Memory System" vision doc > `plan.md` / `docs/ROADMAP.md`
> (both **stale, do not trust**).

## Why this doc exists

Four documents describe Dripnex and they disagree:

| Doc                                               | What it is                                      | Trust                             |
| ------------------------------------------------- | ----------------------------------------------- | --------------------------------- |
| **GitHub issues E1–E18**                          | The real, sequenced, dependency-aware roadmap   | ✅ Source of truth                |
| **Vision doc** ("Agentic Software Memory System") | North-star narrative / concept                  | ⚠️ Concept only, not a stack spec |
| `plan.md` (root)                                  | v1.0 "markdown-first, AI deferred" architecture | ❌ Stale — superseded by pivot    |
| `docs/ROADMAP.md`                                 | v0.5.0 "close the Inkdrop gap" plan             | ❌ Stale — pre-pivot              |

This doc resolves the divergences so nobody (human or agent) builds against the wrong map.

---

## 1. Divergence table

Legend: **DECIDED** = issues already chose, build accordingly · **ALIGNED** = vision and
issues agree · **OPEN** = needs founder ratification (see §2).

| #   | Topic             | Vision doc says                                                             | Issues + code reality                                                                                                      | Status                       |
| --- | ----------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | Desktop runtime   | **Tauri v2**                                                                | Electron, locked. E2 (#320) is a _half-day paper spike_ only — "Decision already locked: Electron base, no rewrite"        | **DECIDED → Electron**       |
| 2   | Core engine       | **Rust** "the heart of the product"                                         | TypeScript: `packages/core` + `ai-core` `ContextBuilder` + `storage` link index. No Rust anywhere (no `Cargo.toml`)        | **DECIDED → TS**             |
| 3   | MCP server        | **Rust MCP server**                                                         | TypeScript `@dripnex/mcp-server`, extracted as public satellite (E4 #333)                                                  | **DECIDED → TS**             |
| 4   | Primary unit      | **Artifact-first** (not notes)                                              | Notes + **typed frontmatter** carry the artifact logic (E9 #363). "Artifact" = note with a `type` + structured frontmatter | **OPEN** (see D1)            |
| 5   | Artifact taxonomy | Plan / Decision / RFC / Investigation / Migration / Audit / Incident / Task | E9 frontmatter v1 ships generic `project / status / relations / dates / custom`; **no `type` enum yet**                    | **OPEN — gap** (see D1)      |
| 6   | Semantic storage  | SQLite + FTS5 + sqlite-vec                                                  | Exactly that — E13 (#384) embeddings table, gated on E2 spike (#319)                                                       | **ALIGNED**                  |
| 7   | Graph             | Relations in SQLite, **no Neo4j**                                           | E9 link index (#364) + E11 WebGL graph (#375). Same call                                                                   | **ALIGNED**                  |
| 8   | Sync              | **CRDTs (Yjs / Automerge)**                                                 | Existing AES-256-GCM E2E sync; E8 `sync-service` is **push/pull/conflict**, not CRDT                                       | **OPEN** (see D2)            |
| 9   | Model-agnostic    | Claude / GPT / Gemini / Ollama / vLLM                                       | `ai-core` has anthropic / openai / ollama via `fetch`; E14 `ai-gateway` adds quotas/keys. Gemini + vLLM not built          | **ALIGNED** (subset shipped) |
| 10  | Local-first       | Default, offline                                                            | Same — offline-first is a non-negotiable                                                                                   | **ALIGNED**                  |
| 11  | Backend           | (silent)                                                                    | E5/E8/E14: decompose Hono+Turso monolith into **5 Cloudflare Workers**                                                     | **OPEN — capacity** (see D3) |
| 12  | "Context Engine"  | Rust, builds optimal agent context                                          | `ContextBuilder v2` (E13 #387) — TS, graph traversal + semantic fill under token budget                                    | **ALIGNED** (TS, not Rust)   |

**Bottom line:** the vision doc's _stack_ (Rust + Tauri + Rust-MCP) was rejected. Its
_ideas_ (artifact-centric memory, local-first, model-agnostic, context-before-generation,
SQLite graph, semantic retrieval) are all alive and map cleanly onto the TS/Electron
implementation. Treat the vision doc as **product narrative**, never as a build spec.

---

## 2. Open decisions (need a founder call)

### D1 — Encode the artifact-type taxonomy in frontmatter v1? **(recommend: YES, lightweight)**

The vision's whole thesis is "artifact-first." Today E9 (#363) ships a generic frontmatter
schema with no `type`. If artifact-first is real, add a `type` enum now — it's cheap at
schema-design time and expensive to retrofit once notes exist in the wild.

Recommendation: add an **open** `type` field to frontmatter v1:

```yaml
---
type: decision # plan | decision | rfc | investigation | migration | audit | incident | task | note
status: accepted
project: dripnex-core
relations:
  supersedes: [adr-001]
---
```

Keep it open-vocabulary (string, with a known set) so the MCP tools (E10) and ContextBuilder
(E13) can filter by artifact type without a migration later. This makes #363 the single
schema doc that becomes the MCP tool contract in Q3 — exactly as E9's body promises.

### D2 — CRDT sync (Yjs/Automerge) vs keep push/pull? **(recommend: DEFER CRDT)**

CRDTs only pay off for real-time multi-writer collaboration. Dripnex is single-user
local-first today, and `plan.md`'s own non-goals listed collaboration as "Never (v1)."
The shipped AES E2E push/pull/conflict model (E8 #359) is sufficient and far simpler.

Recommendation: **defer CRDT** to a future "teams" epic; do not let the vision doc pull
Yjs/Automerge into the Q2 sync-service split. Revisit only if real-time collab becomes a
funded goal.

### D3 — Full 5-Worker split vs slim monolith? **(recommend: PHASE IT — auth+sync only until traction)**

This is the single largest scope/capacity risk. E5+E8+E14 decompose the backend into
auth / sync / ai-gateway / plugin-registry / billing-webhooks. The issues themselves admit
"contract-versioning overhead on a 2-person team." Five independently-deployed Workers,
five staging envs, five smoke suites, shared `@dripnex/contracts` versioning — that is a lot
of operational surface for two people pre-revenue.

Recommendation:

- **Do** E8 (auth + sync extraction) — gives a collaborator one ownable unit and isolates the
  two cleanest boundaries.
- **Gate** E14 (ai-gateway / plugin-registry / billing split) on actual need:
  - `plugin-registry` only when the marketplace (E16) is genuinely next.
  - `billing-webhooks` isolation is cheap and worth it (smallest blast radius for Stripe).
  - `ai-gateway` only matters for a **web/team** future — the desktop BYO-key path explicitly
    does _not_ route through it (per E14's own body). So it can wait.
- Keep a **slim monolith** for everything not yet extracted; let traffic evidence decide the
  monolith-retirement audit (#390), not architectural purity.

### D4 — Tauri: close the door? **(recommend: keep #320 as a paper spike, then formally kill it)**

E2 already treats Tauri as a non-starter ("Electron base, no rewrite"). Run #320 as the
half-day paper PoC, write the decision record (#321), and **close the option explicitly** so
it stops resurfacing. The vision doc should be updated to say "Electron" or annotated as
superseded.

---

## 3. Concept → implementation map (for the vision doc readers)

| Vision concept  | Where it actually lives                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| Artifact        | Note + typed frontmatter (`packages/core`, E9)                               |
| Core Engine     | `packages/core` + `ai-core/ContextBuilder` + `storage` link/embeddings index |
| Context Engine  | `ContextBuilder v2` (#387) — graph traversal + semantic fill, token-budgeted |
| MCP Layer       | `@dripnex/mcp-server` (TS), E10 write/query/graph tools                      |
| Embedding Layer | sqlite-vec + incremental indexing (E13 #384), offline-first source per spike |
| Graph Layer     | `links` table in SQLite (E9 #364) + `@dripnex/plugin-graph` WebGL (E11)      |
| Sync Layer      | `sync-service` Worker push/pull/conflict (E8) — **not** CRDT (see D2)        |
| Model-agnostic  | `ai-core` providers + `ai-gateway` (E14)                                     |

---

## 4. Action items out of this reconciliation

- [ ] Ratify D1–D4 (founder).
- [ ] If D1 = yes: amend #363 to include the `type` enum before building the schema.
- [ ] Annotate the vision doc header: "north-star concept; stack is Electron/TS, see scope-reconciliation."
- [ ] Mark `plan.md` and `docs/ROADMAP.md` as superseded (move to `docs/archived/`).
- [ ] If D3 = phase: re-label E14 children — keep `billing-webhooks`, gate `ai-gateway` and
      `plugin-registry` behind explicit triggers.
