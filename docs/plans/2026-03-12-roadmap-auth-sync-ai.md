# Roadmap: Auth Rethink + Sync Testing + AI UX

> Created: 2026-03-12
> Updated: 2026-03-13
> Status: Phase 3 complete — Phase 4 & 5 pending
> Branch: develop

---

## Backend Status (Verified 2026-03-13)

| Endpoint                 | Status      | Notes                                      |
| ------------------------ | ----------- | ------------------------------------------ |
| `GET /health`            | 200 OK      | API live on Cloudflare Workers             |
| `POST /auth/magic-link`  | 200 OK      | Resend email delivery working              |
| `POST /auth/verify`      | 400 (valid) | Zod validates UUID token format            |
| `GET /auth/me` + bad JWT | **401**     | **Fixed**: all jose error types return 401 |

- **API URL**: `https://api.readied.app`
- **Email**: Resend (`noreply@readied.app`)
- **Database**: Turso (libsql)
- **Hosting**: Cloudflare Workers
- **API Docs**: `docs/plans/api-reference.md`

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Website Redesign Fixes

- [x] Apply 30 CodeRabbit review fixes (commit `507f8ce`)
- [x] Push to `feature/website-redesign`
- [x] Merge PR #148 to develop
- [x] Fix NumberTicker `locale` ReferenceError (SSG prerender crash)
- [x] Fix Turbopack incompatibility (remove --turbopack, use webpack extensionAlias)
- [x] Fix licensing package exports (point to source, not dist/)

### 1.2 Auth UX Rethink

- [x] "Enable Sync" modal redesign
- [x] Deep link race condition fix
- [x] Auth middleware: all jose error types → 401 with JSON responses

### 1.3 Backend Fixes

- [x] Fix `/auth/me` returning 500 on invalid JWT → now returns 401
- [x] Document API endpoints → `docs/plans/api-reference.md` (24 endpoints)

---

## Phase 2: Sync Stability ✅ COMPLETE

### Known Issues — All Fixed

- [x] `syncService.ts` — auto-sync error propagation to renderer via IPC events
- [x] `syncService.ts` — exponential backoff on repeated failures (cap 5min)
- [x] `syncService.ts` — 401 auto-stops sync + emits `auth-expired` event
- [x] `syncService.ts` — abort in-flight sync on logout via AbortController
- [x] `apiClient.ts` — token refresh returns typed errors (expired/network/device_limit)
- [x] `apiClient.ts` — distinguish refresh failure modes for UI

### Deliverables

- [ ] End-to-end sync testing (all 6 scenarios) — needs manual testing
- [x] Fix sync error handling (no silent failures)
- [x] Sync onboarding flow (prompt after 5 notes, session-dismissable)
- [ ] Conflict resolution UX improvements — existing UI functional
- [x] Offline queue visibility in status bar (pending count + offline indicator)

---

## Phase 3: AI Commands (Cmd+K v1) ✅ COMPLETE

### What Was Built

- [x] Remap Cmd+K → AI panel; insert-link moved to Cmd+Shift+K
- [x] AI command definitions: `ai:toggle-panel`, `ai:summarize`, `ai:rewrite`, `ai:tweet`
- [x] New `'ai'` command category in registry
- [x] AiPanel integrated into App layout (right-side panel)
- [x] `useRegisterAiCommands` hook following existing patterns
- [x] AI Settings section: API key, model selector, max context notes
- [x] Settings schema v2 with migration from v1
- [x] AiPanel reads settings store for API key and model
- [x] Escape cascade updated: palette → AI panel → graph → search
- [x] Existing `packages/ai-assistant/` (Claude client, RAG, prompts) wired into panel

### Decisions Made

1. **AI Provider**: API key stored in Settings > AI Assistant (encrypted via Zustand persist)
2. **Keybinding**: Cmd+K = AI panel (global), Cmd+Shift+K = insert link (editor)
3. **Streaming**: Wait for complete response (v1 simplicity)
4. **Context**: Current note + RAG across all notes via `buildRagPrompt`

---

## Phase 4: AI Knowledge (Cmd+K v2) — PENDING

- [ ] RAG integration — query across notes
- [ ] "Ask your notes" command
- [ ] Related notes context in AI prompts
- [ ] Custom prompt with knowledge context

---

## Phase 5: Extensibility — PENDING

- [ ] Plugin API for custom AI commands
- [ ] Community command marketplace concept
- [ ] Import/export AI command definitions

---

## Infrastructure Fixes (2026-03-13)

- [x] Align develop with main (merge main → develop)
- [x] Add `._*` to .gitignore (macOS resource forks on exFAT volumes)

---

## Verification Checklist

| Feature             | How to verify                                       | Status   |
| ------------------- | --------------------------------------------------- | -------- |
| Website             | `pnpm typecheck` + CI green                         | ✅ Pass  |
| Auth middleware     | Invalid JWT → 401 JSON (not 500)                    | ✅ Pass  |
| Sync error handling | Auto-sync failure → renderer sees error + backoff   | ✅ Built |
| Sync onboarding     | Create 5+ notes → "Enable Sync" prompt in sidebar   | ✅ Built |
| Offline indicator   | Go offline → "N changes pending" in sidebar footer  | ✅ Built |
| Cmd+K               | Press Cmd+K → AI panel opens                        | ✅ Built |
| AI Settings         | Settings > AI Assistant → configure API key + model | ✅ Built |
| Login               | Enter email → receive link → verify in app          | Manual   |
| Sync e2e            | Create note → sync → verify on second device        | Manual   |
