# Roadmap: Auth Rethink + Sync Testing + AI UX

> Created: 2026-03-12
> Status: Active
> Branch: feature/website-redesign (website fixes), develop (auth/sync/AI work)

---

## Backend Status (Verified 2026-03-12)

| Endpoint                 | Status      | Notes                               |
| ------------------------ | ----------- | ----------------------------------- |
| `GET /health`            | 200 OK      | API live on Cloudflare Workers      |
| `POST /auth/magic-link`  | 200 OK      | Resend email delivery working       |
| `POST /auth/verify`      | 400 (valid) | Zod validates UUID token format     |
| `GET /auth/me` + bad JWT | **500**     | **Bug**: should return 401, not 500 |

- **API URL**: `https://api.readied.app`
- **Email**: Resend (`noreply@readied.app`)
- **Database**: Turso (libsql)
- **Hosting**: Cloudflare Workers

---

## Phase 1: Foundation (Current Sprint)

### 1.1 Website Redesign Fixes

- [x] Apply 30 CodeRabbit review fixes (commit `507f8ce`)
- [x] Push to `feature/website-redesign`
- [ ] Merge PR #142 to develop

### 1.2 Auth UX Rethink

**Problem**: Login is buried in Settings > Account. No onboarding. No registration step visible. New users don't know sync exists.

**Current flow**: Settings > Account > Enter email > Magic link > Deep link > Token > Sync starts

**Proposed flow**:

1. App works 100% locally (no account required)
2. After N notes, subtle "Sync across devices" prompt
3. "Enable Sync" button in sidebar footer or status bar
4. Modal with clear value proposition + email input
5. Magic link verification + auto-sync start
6. Success toast + sync indicator in status bar

**Files to change**:
| File | Change |
|------|--------|
| `renderer/components/sync/LoginModal.tsx` | Redesign as "Enable Sync" modal |
| `renderer/stores/authStore.ts` | Add `isFirstTimeUser`, better errors |
| `renderer/components/Sidebar.tsx` or `StatusBar.tsx` | Add "Enable Sync" entry point |
| `main/index.ts` (deep link handler) | Fix window discovery race condition |
| `packages/api/src/middleware/auth.ts` | Fix 500→401 for invalid JWTs |

### 1.3 Backend Fixes

- [ ] Fix `/auth/me` returning 500 on invalid JWT (should be 401)
- [ ] Test magic link email delivery end-to-end
- [ ] Document API endpoints for team reference

---

## Phase 2: Sync Stability

### Test Matrix

1. **Auth round-trip**: magic link → verify → JWT
2. **Push**: create note locally → sync → verify on server
3. **Pull**: modify on server → pull → verify local
4. **Conflict**: edit same note on two devices → conflict UI
5. **Offline**: go offline → edit → reconnect → queued sync
6. **Encryption**: verify content encrypted in transit

### Known Issues

- `syncService.ts` — auto-sync starts but no error handling on failure
- `authStore.ts` — logout doesn't await sync stop
- Device ID generation and persistence unclear
- Token refresh on 401 may not retry original request

### Deliverables

- [ ] End-to-end sync testing (all 6 scenarios)
- [ ] Fix sync error handling (no silent failures)
- [ ] Sync onboarding flow (prompt after N notes)
- [ ] Conflict resolution UX improvements
- [ ] Offline queue visibility in status bar

---

## Phase 3: AI Commands (Cmd+K v1)

### Current State

- **Cmd+P** = Command Palette (21 commands)
- **Cmd+K** = Currently mapped to `editor:insert-link`
- **AI Infrastructure** = `packages/ai-assistant/` exists (Claude client, prompts, RAG) but no UI commands wired

### Design: Cmd+K Panel

**Trigger**: Cmd+K (remap insert-link to Cmd+Shift+K)

**Sections**:

- Quick Actions (New Note, Search, Open Recent)
- AI Transform (requires selection): Summarize, Tweet, Rewrite, Extract, Expand, Blog Outline, Custom
- AI Ask (knowledge context): Ask about notes, Find related ideas
- Settings: Configure AI Provider

### Architecture

```
renderer/components/CommandK/
  ├── CommandKPanel.tsx        # Modal overlay
  ├── CommandKInput.tsx        # Search + AI input
  ├── CommandKResults.tsx      # Result list
  ├── CommandKPreview.tsx      # Preview pane (streaming AI)
  └── useCommandK.ts           # State hook

packages/ai-assistant/src/
  ├── commands/                 # AI command definitions
  └── registry.ts              # Command registry
```

### Workflow

```
Select text → Cmd+K → "Summarize" → AI streams result → Preview → "Insert" → Replaces selection
```

### Decisions Needed

1. AI Provider: Claude API key stored in Settings? `.env`?
2. Keybinding: Cmd+K context-aware (editor vs global) or remap?
3. Streaming: show live or wait for complete?
4. Context: current note only or RAG across all notes?

### Deliverables

- [ ] Remap Cmd+K / resolve keybinding conflict
- [ ] Build CommandK panel component
- [ ] Wire 3 core AI commands (summarize, rewrite, tweet)
- [ ] AI provider settings (API key in Settings)
- [ ] Streaming preview
- [ ] Insert/replace at cursor

---

## Phase 4: AI Knowledge (Cmd+K v2)

- [ ] RAG integration — query across notes
- [ ] "Ask your notes" command
- [ ] Related notes context in AI prompts
- [ ] Custom prompt with knowledge context

---

## Phase 5: Extensibility

- [ ] Plugin API for custom AI commands
- [ ] Community command marketplace concept
- [ ] Import/export AI command definitions

---

## Verification Checklist

| Feature       | How to verify                                       |
| ------------- | --------------------------------------------------- |
| Website fixes | `pnpm typecheck` + CI green                         |
| Login         | Enter email → receive link → verify in app          |
| Sync          | Create note → sync → verify on second device        |
| Cmd+K         | Select text → Cmd+K → AI command → verify insertion |
