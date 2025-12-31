# READIED — Technical Architecture v1.0

> Intelligent, offline-first desktop note app.
> Solid core. Extensible. Monetizable. Maintainable 3-5 years.

---

## 1. Vision

**Goal:** Build a note-taking app that competes with Obsidian/Inkdrop through superior architecture, not feature bloat.

**What Readied IS:**
- Offline-first desktop app (Electron)
- Markdown-based with smart features (backlinks, tags, graph)
- Single-user, local-first (sync optional later)
- Premium product with clear monetization

**What Readied is NOT:**
- A Notion clone (no blocks-first architecture)
- A collaboration tool (not yet)
- A mobile app (desktop first)

### 1.1 Product Identity

**Thesis:** Readied is a Markdown-first app that happens to be smart — not a smart system that happens to use Markdown.

**This means:**
- Markdown preservation > intelligence features
- Export fidelity > internal efficiency
- User trust > clever optimization

**One-liner:** "Your notes survive the app."

**Competitive position:**
- Not competing with Inkdrop (closed DB, sync-first)
- Competing with: Obsidian (but more coherent), VS Code + Markdown (but real product), "my folder of notes I don't want to lose"

---

## 2. Non-Negotiables

| Principle | Rule |
|-----------|------|
| **Core first** | Core runs without Electron, React, or UI. Testable in pure Node. |
| **Offline-first** | 100% functional without internet. Sync is a feature, not a requirement. |
| **Strict separation** | Core ≠ UI ≠ Infra ≠ Packaging. React never decides domain logic. |
| **Minimal deps** | Every library needs written justification. No "just in case" abstractions. |

---

## 3. Frozen Decisions

### 3.1 Runtime & Tooling
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | pnpm + turborepo | Isolate concerns, share core across apps |
| Electron tooling | electron-vite | Fast HMR, clear main/preload/renderer boundaries |
| Node version | 20 LTS | Stability |

### 3.2 Database
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Local DB | SQLite (main process) | Robust, file-based, portable, queryable |
| Access pattern | Typed repositories via IPC | No raw SQL in renderer |
| Migrations | Forward-only, versioned | Safe evolution |

### 3.3 Editor
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Engine | CodeMirror 6 | Modular, extensible, performant |
| Relationship to core | Editor edits markdown directly | Markdown text is the canonical source |

### 3.4 Note Model (Option A: Markdown Source of Truth)
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source of truth | **Markdown text** | Simple, portable, compatible with ecosystem |
| Domain model | AST + derived indices | Parsed from markdown, NOT a separate canonical structure |
| Derived data | title, tags, backlinks, headings | Computed on parse/save, stored as columns for queries |
| Storage | Full Markdown in SQLite + metadata columns | Fast queries + full content |

**Clarification:**
- Canonical = the markdown text itself
- Domain = AST parsed from markdown + derived indices (NOT a separate structure)
- Editor edits markdown; core parses/validates; indices are derived
- If parse fails, raw markdown is preserved (never lost)

### 3.5 Markdown Preservation Invariants

| Invariant | Rule | Why |
|-----------|------|-----|
| Raw text is sacred | User-typed markdown is NEVER auto-modified | Trust |
| AST is ephemeral | AST exists only for parsing, never persisted as authority | Simplicity |
| Parse errors don't block | If parse fails, save raw markdown anyway | Data safety |
| No normalization | Never reformat whitespace, headings, lists | Preserve intent |
| No serialization from AST | Never reconstruct markdown from parsed AST | Fidelity |

**Golden rule:** "If the user typed it, we keep it."

**Consequences:**
- No "prettify markdown" feature
- No auto-fix for broken links
- No whitespace normalization
- Export = exact copy of stored markdown

### 3.6 UI State
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Async/server state | TanStack Query | Cache, sync, invalidation |
| UI-only state | Zustand | Minimal, no boilerplate |
| Avoid | Redux, global god-state | Unnecessary complexity |

### 3.7 CSS & Design System
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Foundation | CSS Variables (tokens) | Themeable, simple |
| Primitives | Radix UI | Accessible, unstyled |
| Components | shadcn/ui (editable) | Copy-paste, full control |
| Utility | Tailwind (as engine only) | Fast iteration |
| Editor styles | Isolated scope | Never inherit from UI kit |

---

## 4. Architecture

### 4.1 Monorepo Structure (v0.1 — Simplified)

> **Principle:** Start with 5 packages, not 9. Split when there's actual pain.

```
readied/
├── apps/
│   ├── desktop/              # Electron app
│   │   ├── src/main/         # Main process (SQLite, IPC handlers)
│   │   ├── src/preload/      # Secure bridge
│   │   └── src/renderer/     # React UI
│   ├── marketing-site/       # Landing, pricing
│   └── docs-site/            # Technical docs (VitePress)
├── packages/
│   ├── core/                 # Domain + app layer + markdown parsing
│   ├── storage/              # SQLite adapter + migrations
│   ├── ipc-contract/         # Typed IPC channels (Zod schemas)
│   ├── licensing/            # License validation, trial
│   └── ui-kit/               # React components + design tokens
├── pnpm-workspace.yaml
└── turbo.json
```

**Deferred to v0.2+ (split when needed):**
- `packages/app` — Extract from core when use-cases grow complex
- `packages/markdown` — Extract when AST handling needs isolation
- `packages/product-config` — Hardcode pricing in marketing + app for now
- `packages/design-tokens` — Keep inside ui-kit for now

**Why simplify:**
- Less package orchestration overhead
- Faster iteration for solo dev
- Split when there's actual pain, not theoretical purity

### 4.2 Core Package Structure
```
packages/core/
├── domain/
│   ├── note.ts               # Note entity
│   ├── metadata.ts           # Title, created, updated, tags
│   ├── link.ts               # Backlink/forward link
│   └── invariants.ts         # Business rules
├── operations/
│   ├── createNote.ts
│   ├── updateNote.ts
│   ├── deleteNote.ts
│   └── linkNotes.ts
├── queries/
│   ├── getNoteById.ts
│   ├── searchNotes.ts
│   └── getBacklinks.ts
├── contracts/
│   ├── NoteInput.ts          # What enters the core
│   ├── NoteSnapshot.ts       # What exits the core
│   └── CoreResult.ts         # Operation results
├── validation/
│   └── schemas.ts            # Zod schemas
└── index.ts                  # Public API
```

### 4.3 Contracts & Boundaries

**Core Runtime Contract:**
- Core exposes Commands (mutations) and Queries (reads)
- UI calls use-cases, never internal functions
- All I/O goes through ports/adapters

**Storage Contract:**
```typescript
interface NoteRepository {
  get(id: NoteId): Promise<Note | null>
  save(note: Note): Promise<void>
  delete(id: NoteId): Promise<void>
  list(query: NoteQuery): Promise<Note[]>
  search(term: string): Promise<Note[]>
}
```

**IPC Contract:**
- All channels typed with Zod schemas in `packages/ipc-contract`
- No `executeSQL` exposed to renderer
- Batch APIs for performance (e.g., `getNotesPage` not `getNoteById` x100)

---

## 5. Pending Decisions

| Topic | Status | Notes |
|-------|--------|-------|
| Plugin system | Deferred | Define boundary now, implement later |
| Monetization | Design phase | Need entitlements, gating, license.json |
| Sync | Deferred | Schema ready (updatedAt, revision, deviceId) |
| Full-text search | Deferred | SQLite FTS5 or separate index |

---

## 6. Accepted Technical Debt

| Debt | Risk | Mitigation |
|------|------|------------|
| No sync | Low | Schema has sync-ready fields |
| No mobile | Low | Core is portable |
| No plugins | Medium | Boundary defined, not implemented |
| Basic search | Low | FTS5 can be added later |
| No collaboration | Low | Single-user is the product |

---

## 7. Security Rules

| Rule | Description |
|------|-------------|
| Preload minimal | Only expose necessary APIs |
| IPC whitelist | Typed channels, no generic `executeSQL` |
| No nodeIntegration | Renderer is sandboxed |
| Schemas shared | `packages/ipc-contract` validates both sides |

---

## 8. Sync-Ready Schema Fields

Even without sync, include these from day 1:

```typescript
interface NoteRecord {
  id: string
  content: string           // Full Markdown
  title: string
  createdAt: string         // ISO 8601
  updatedAt: string         // ISO 8601
  deletedAt: string | null  // Soft delete
  revision: number          // Optimistic locking
  deviceId: string          // Future sync
}
```

### 8.1 Storage Implementation Decisions

| Decision | v0.1 Choice | Rationale |
|----------|-------------|-----------|
| Pagination | Cursor-based | Scales with large note counts, stable ordering |
| Full-text search | `LIKE '%term%'` | Simple, good enough for <10k notes. FTS5 deferred. |
| Indices | `updatedAt`, `deletedAt`, `title` | Sorted lists, soft-delete queries, search |
| Reindex | On save (sync) | Simplest model, no background workers |
| Batch operations | None | Single-note ops only in v0.1 |

**Pagination pattern:**
```typescript
interface ListNotesQuery {
  cursor?: string      // Last note ID from previous page
  limit: number        // Default 50, max 100
  sort: 'updatedAt' | 'createdAt' | 'title'
  direction: 'asc' | 'desc'
  filter?: {
    deletedOnly?: boolean
    tag?: string
  }
}

// SQL example
const sql = `
  SELECT * FROM notes
  WHERE deletedAt IS NULL
    AND updatedAt < ?
  ORDER BY updatedAt DESC
  LIMIT ?
`
```

**Why not FTS5 in v0.1:**
- Adds complexity (separate table, triggers)
- LIKE is fine for most users (<5k notes)
- FTS5 can be added later without migration (new table + backfill)

**Future (v0.2+):**
- FTS5 for full-text search
- Batch import/export
- Background indexing

---

## 9. Release & Distribution

> Without signing and auto-update from day 1, the app doesn't exist as a product.

### 9.1 CI/CD Stack

| Component | Decision | Rationale |
|-----------|----------|-----------|
| CI | GitHub Actions | Free, integrated, battle-tested |
| Build | electron-builder | Standard for Electron apps |
| Artifacts | GitHub Releases | Free hosting, auto-update compatible |
| Secrets | GitHub Secrets | Secure, no extra infra |

### 9.2 Code Signing

| Platform | Requirement | Cost | Priority |
|----------|-------------|------|----------|
| macOS | Apple Developer ID + Notarization | $99/year | Day 1 |
| Windows | Code Signing Certificate | $100-200/year | Day 1 |
| Windows | EV Code Signing (SmartScreen trust) | $300-500/year | When traction |

**macOS Config (electron-builder):**
```json
{
  "mac": {
    "hardenedRuntime": true,
    "entitlements": "entitlements.mac.plist",
    "entitlementsInherit": "entitlements.mac.plist",
    "gatekeeperAssess": false,
    "target": ["dmg"]
  }
}
```

### 9.3 Auto-Update

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Updater | electron-updater | Built-in, reliable |
| Feed | GitHub Releases | Free, simple |
| Policy | Mandatory from v0.1.0 | Bugs must be fixable |

```typescript
import { autoUpdater } from 'electron-updater'
autoUpdater.checkForUpdatesAndNotify()
```

### 9.4 Versioning Strategy

```typescript
interface VersionInfo {
  appVersion: string      // "0.3.2" - SemVer
  domainVersion: number   // 2 - Core model version
  schemaVersion: number   // 5 - SQLite schema version
}
```

**Rules:**
- Forward-only migrations (never rollback schema)
- Automatic backup before any migration
- Never break user data on update

### 9.5 Release Pipeline

```
git tag v0.1.0
       ↓
GitHub Actions (matrix: mac + win)
       ↓
Build + Sign binaries
       ↓
Notarize (macOS)
       ↓
Publish to GitHub Releases
       ↓
Auto-update feed live
```

### 9.6 Costs Summary

| Item | Annual Cost |
|------|-------------|
| Apple Developer Program | $99 |
| Windows Code Signing | $100-200 |
| GitHub Actions | Free tier |
| **Total (minimum)** | **~$200/year** |

---

## 10. Implementation Order

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **0** | This document | Architecture frozen |
| **1** | Bootstrap | Monorepo + `packages/core` with tests |
| **2** | Storage | `packages/storage` + SQLite + migrations |
| **3** | IPC | `packages/ipc-contract` + electron-vite setup |
| **4** | CI/Release | GitHub Actions + signing + auto-update |
| **5** | UI | `packages/ui-kit` + design tokens + basic shell |
| **6** | Editor | CodeMirror 6 integration |
| **7** | Integration | Full app working end-to-end |
| **8** | Polish | Error handling, edge cases, performance |

---

## 11. Documentation System

> Documentation is part of the product, not an afterthought.

### 11.1 Tool Choice

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **VitePress** | ✅ Chosen | Vite-based, Markdown-native, versionable, simple |
| Docusaurus | ❌ | Too heavy, React everywhere, overkill for indie |
| Astro + MDX | ❌ | Overkill unless marketing + docs are merged |

### 11.2 Documentation Structure

```
apps/docs-site/
├── .vitepress/
│   ├── config.ts
│   └── sidebar.ts
├── guide/
│   ├── getting-started.md
│   └── principles.md
├── architecture/
│   ├── overview.md
│   ├── core.md
│   ├── application-layer.md
│   ├── storage.md
│   ├── ipc.md
│   ├── editor.md
│   └── theming.md
├── decisions/
│   ├── ADR-001-runtime-contract.md
│   ├── ADR-002-markdown-model.md
│   ├── ADR-003-sqlite.md
│   ├── ADR-004-css-system.md
│   └── ADR-005-monetization.md
├── operations/
│   ├── release-process.md
│   ├── signing.md
│   └── updates.md
└── roadmap/
    ├── mvp.md
    ├── v0.1.md
    └── v0.2.md
```

### 11.3 Documentation Categories

| Category | Purpose |
|----------|---------|
| **Guide** | How to get started, principles |
| **Architecture** | How things work |
| **Decisions (ADR)** | Why things were chosen |
| **Operations** | How to distribute/release |
| **Roadmap** | What gets built and in what order |

**Rule:** Never mix categories. Architecture ≠ Decisions ≠ Operations.

### 11.4 ADR Template

```markdown
# ADR-XXX: [Title]

## Status
Accepted | Superseded | Deprecated

## Context
What problem are we solving?

## Decision
What did we decide?

## Consequences
- Positive:
- Negative:
- Risks:

## Alternatives Considered
1. Option A — rejected because...
2. Option B — rejected because...
```

---

## 12. Observability

> You can't fix what you can't see.

### 12.1 Error Tracking

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Error capture | Sentry | Industry standard, good Electron support |
| Scope | Main + Renderer | Catch both process types |
| Privacy | No PII in payloads | User trust |

### 12.2 Minimal Telemetry (Optional)

| What | Purpose | Consent |
|------|---------|---------|
| App version | Know adoption | Implicit |
| Crash reports | Fix bugs | Explicit opt-in |
| Feature usage | Prioritize roadmap | Explicit opt-in |

**Rule:** Telemetry is OFF by default. User must opt-in.

### 12.3 Local Logging

```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  timestamp: string
  context: string
  message: string
  data?: unknown
}
```

- Logs stored locally (rotating, max 10MB)
- User can export logs for support
- Never send logs without consent

---

## 13. Domain Versioning Strategy

> Schema changes are inevitable. Plan for them from day 1.

### 13.1 Version Types

| Version | Purpose | Location |
|---------|---------|----------|
| `appVersion` | Release version (SemVer) | package.json |
| `schemaVersion` | SQLite schema version | migrations table |
| `domainVersion` | Note model structure | note record |
| `serializationVersion` | Markdown format version | note frontmatter |

### 13.2 Domain Model Versioning

```typescript
interface NoteRecord {
  // ... existing fields
  domainVersion: number  // Current: 1
}
```

**Rules:**
- Bump `domainVersion` when Note structure changes
- Old versions readable forever (forward compatibility)
- Migrations transform old → new on read
- Never break existing data

### 13.3 Serialization Versioning

```yaml
---
serializationVersion: 1
title: My Note
tags: [foo, bar]
---
```

**Rules:**
- Frontmatter declares format version
- Parser handles all known versions
- Export always uses latest version
- Import handles older formats gracefully

### 13.4 Migration Contract

```typescript
interface DomainMigration {
  from: number
  to: number
  migrate: (old: unknown) => NoteRecord
  canRollback: boolean
}
```

**Rules:**
- Migrations are pure functions
- Each migration tested independently
- Chain migrations for multi-version jumps
- Rollback only if explicitly safe

---

## 14. Data Ownership & Portability

> Zero lock-in. User data belongs to the user.

### 14.1 Data Directory

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/Readied/` |
| Windows | `%APPDATA%/Readied/` |
| Linux | `~/.config/Readied/` |

**Structure:**
```
Readied/
├── readied.db          # SQLite database
├── backups/            # Automatic backups
├── logs/               # Application logs
└── config.json         # User preferences
```

### 14.2 Export Format

**Primary:** Markdown + JSON metadata

```
export/
├── notes/
│   ├── note-1.md
│   ├── note-2.md
│   └── ...
├── metadata.json       # Tags, links, timestamps
└── manifest.json       # Export version, date
```

**Guarantees:**
- Markdown files are valid, standalone
- Can be opened in any editor
- metadata.json preserves structure
- Re-importable to Readied

### 14.3 Import Support (v0.1)

| Source | Support |
|--------|---------|
| Obsidian vault | Basic (read .md files) |
| Plain Markdown folder | Full |
| Other apps | Deferred |

**Import process:**
1. Select folder
2. Scan for .md files
3. Parse frontmatter (if exists)
4. Create notes with original timestamps (if available)

#### Obsidian Import Compatibility Matrix

| Feature | v0.1 | Notes |
|---------|------|-------|
| `.md` files | ✅ | Basic read, preserves content |
| YAML frontmatter | ✅ | `tags`, `created`, `updated`, `aliases` |
| Wikilinks `[[note]]` | ✅ | Converted to internal links |
| Wikilinks with alias `[[note\|display]]` | ✅ | Preserves display text |
| Headings `[[note#heading]]` | ⚠️ | Link preserved, heading jump deferred |
| Obsidian embeds `![[image.png]]` | ❌ | Deferred to v0.2 |
| Attachments folder | ❌ | Deferred to v0.2 |
| Aliases (frontmatter) | ⚠️ | Parsed, search support deferred |
| Tags in body `#tag` | ✅ | Extracted to tags array |
| Nested tags `#parent/child` | ⚠️ | Flattened to `parent-child` |
| Daily notes | ✅ | Imported as regular notes |
| Templates folder | ⚠️ | Imported as notes (no template behavior) |
| Dataview queries | ❌ | Not interpreted, kept as code blocks |
| Obsidian plugins data | ❌ | Ignored (`.obsidian/` folder) |

**Legend:**
- ✅ Fully supported
- ⚠️ Partially supported
- ❌ Not supported (deferred)

### 14.4 Uninstall Behavior

- App removal does NOT delete data directory
- User must explicitly delete data
- Clear prompt during uninstall (if possible)

---

## 15. Offline Upgrade Path

> Offline-first means updates work offline too.

### 15.1 Update Flow

```
App starts
    ↓
Check schemaVersion
    ↓
Need migration? → Backup DB → Run migrations → Update version
    ↓
App ready
```

### 15.2 Backup Before Migration

**Automatic backup:**
- Created before ANY schema change
- Stored in `backups/pre-migration-{version}-{timestamp}.db`
- Keep last 3 backups
- User can restore manually

### 15.3 Rollback Strategy

| Scenario | Action |
|----------|--------|
| Migration succeeds | Continue normally |
| Migration fails | Restore backup, block app, show error |
| Corruption detected | Restore backup, notify user |

**Rule:** Never leave data in inconsistent state.

### 15.4 Integrity Check

On every startup:
1. Verify SQLite integrity (`PRAGMA integrity_check`)
2. Verify schema version matches expected
3. If mismatch → attempt recovery or block

---

## 16. Testing Strategy

> Test the core, not the UI.

### 16.1 Test Pyramid

| Layer | Type | Tools | Priority |
|-------|------|-------|----------|
| Core | Unit | Vitest | High |
| Use-cases | Integration | Vitest | High |
| Storage | Integration | Vitest + SQLite | Medium |
| IPC | Contract | Vitest + Zod | Medium |
| E2E | None (v0.x) | — | Deferred |

### 16.2 Core Tests

```typescript
// Example: packages/core/__tests__/createNote.test.ts
describe('createNote', () => {
  it('creates note with valid input', () => {})
  it('rejects empty content', () => {})
  it('generates unique id', () => {})
  it('sets timestamps correctly', () => {})
})
```

**Rules:**
- Pure functions, no mocks needed
- Fast (< 1ms per test)
- 100% coverage of domain logic

### 16.3 Storage Tests

```typescript
// Example: packages/storage/__tests__/noteRepository.test.ts
describe('NoteRepository', () => {
  it('saves and retrieves note', () => {})
  it('handles concurrent writes', () => {})
  it('migrates schema correctly', () => {})
})
```

**Rules:**
- Use real SQLite (in-memory)
- Test migrations explicitly
- Test edge cases (large notes, special chars)

### 16.4 IPC Contract Tests

```typescript
// Verify schemas match between main and renderer
describe('IPC Contract', () => {
  it('request schemas are valid', () => {})
  it('response schemas are valid', () => {})
  it('error schemas are valid', () => {})
})
```

### 16.5 What We DON'T Test (v0.x)

- E2E browser tests (Playwright, Cypress)
- Visual regression tests
- Performance benchmarks
- Accessibility audits

**Reason:** Overhead too high for solo dev. Revisit at v1.0.

---

## 17. Non-Goals

> Knowing what NOT to build is as important as knowing what to build.

### 17.1 Explicit Non-Goals (v0.x - v1.0)

| Feature | Status | Rationale |
|---------|--------|-----------|
| Real-time collaboration | Never (v1) | Different product |
| Cloud sync | Deferred | Focus on offline-first |
| Mobile app | Deferred | Desktop-first |
| Arbitrary plugins | Never | Security + maintenance |
| Block-based editing | Never | Markdown-first identity |
| Multi-user / teams | Never (v1) | Single-user product |
| AI features | Deferred | Not core value prop |
| Web version | Deferred | Desktop is the product |
| Attachments / images | Deferred (v0.2) | Adds complexity; markdown text first |
| Image embeds (`![[img]]`) | Deferred (v0.2) | Requires attachment handling |
| PDF export | Deferred | Not core value |
| Attachments in DB | Never | Always filesystem-based, never embedded blobs |

### 17.2 Why This Matters

Every "no" protects:
- Development focus
- Codebase simplicity
- Maintenance burden
- Security surface

### 17.3 Review Cadence

Non-goals reviewed at major versions:
- v0.x → v1.0: Revisit sync, mobile
- v1.x → v2.0: Revisit collaboration

---

## 18. Monetization Strategy

> Perpetual license + Maintenance. Offline validation. App works forever.

### 18.1 Pricing Model

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Model | **Perpetual + Maintenance** | Best for offline-first indie app |
| License | $79 one-time | Includes 12 months of updates |
| Renewal | $39/year (optional) | 12 more months of updates |
| Trial | 14 days, full features | Let users evaluate properly |
| Processor | Lemon Squeezy | Handles VAT, license keys |

**Why this model:**
- Subscription + offline-only is contradictory (how does app know user renewed?)
- Pure one-time isn't sustainable long-term
- Perpetual + Maintenance: user pays once, app works forever, renewals fund continued development

### 18.2 How It Works

```
User buys license ($79)
         ↓
License includes 12 months of updates
         ↓
After 12 months:
  - App keeps working forever ✅
  - No more updates unless renewed
         ↓
Renewal ($39/year) → 12 more months of updates
```

**Key rules:**
- App NEVER stops working
- App NEVER blocks editing or reading
- Only auto-updates are gated by `updatesUntil`
- No online validation required ever

### 18.3 Update Gating Logic

```typescript
// In auto-updater (main process)
function shouldInstallUpdate(
  newVersion: { releaseDate: string },
  license: { updatesUntil: string }
): boolean {
  const releaseDate = new Date(newVersion.releaseDate)
  const updatesUntil = new Date(license.updatesUntil)

  if (releaseDate <= updatesUntil) {
    return true  // Update is covered by license
  }

  // Update released after license coverage expired
  showUpdatePrompt({
    message: 'A new version is available. Renew to get updates.',
    canDismiss: true,
    renewUrl: 'https://readied.app/renew'
  })
  return false
}
```

### 18.4 License Format

```json
{
  "licenseVersion": 1,
  "licenseId": "lic_8f3a1c",
  "issuedTo": "user@email.com",
  "purchaseDate": "2025-01-15",
  "updatesUntil": "2026-01-15",
  "plan": "pro",
  "capabilities": [
    "notes.unlimited",
    "links.backlinks",
    "search.advanced",
    "export.structured",
    "import.folder",
    "themes.custom",
    "graph.view"
  ],
  "signature": "BASE64_ED25519_SIGNATURE"
}
```

**Fields:**
- `purchaseDate`: When license was purchased
- `updatesUntil`: Last date for receiving updates
- `capabilities`: Features enabled (for future tiering)
- `signature`: Ed25519 signature for offline validation

### 18.5 License States

```typescript
type LicenseStatus =
  | 'trial'           // 14-day trial, all features
  | 'active'          // Valid license, updates included
  | 'active_expired'  // Valid license, updates expired (app works!)
  | 'unlicensed'      // No license (after trial)

interface AppLicenseState {
  status: LicenseStatus
  trial?: {
    startDate: string
    daysRemaining: number
  }
  license?: {
    purchaseDate: string
    updatesUntil: string
    plan: 'pro'
    capabilities: Capability[]
    updatesExpired: boolean  // updatesUntil < today
  }
}
```

### 18.6 Trial Mode

**Trial (14 days)**
- All features enabled
- No credit card required
- Full offline functionality
- After expiry: unlicensed mode

**Unlicensed Mode:**
- All features work (no arbitrary limits)
- Shows persistent "Upgrade" banner
- No auto-updates to newer versions
- Export always allowed

**Rule:** Never punish users. No arbitrary limits. Banner, not blocks.

### 18.7 Capabilities System

```typescript
type Capability =
  | 'notes.basic'          // create / edit / delete notes
  | 'notes.unlimited'      // no note limit
  | 'links.backlinks'      // automatic backlinks
  | 'search.basic'         // simple search
  | 'search.advanced'      // ranking, filters
  | 'export.markdown'      // export .md
  | 'export.structured'    // export md + metadata
  | 'import.folder'        // import md folder
  | 'import.obsidian'      // import Obsidian vault
  | 'themes.custom'        // advanced theming
  | 'graph.view';          // visual graph

// In application layer (NOT in core)
function hasCapability(cap: Capability): boolean {
  const state = getLicenseState()

  if (state.status === 'trial') return true
  if (state.status === 'active' || state.status === 'active_expired') {
    // Licensed users have full access forever
    return state.license?.capabilities.includes(cap) ?? false
  }
  if (state.status === 'unlicensed') {
    // Unlicensed: basic features only
    return cap === 'notes.basic' || cap === 'export.markdown'
  }
  return false
}
```

**Critical rule:** Core does NOT know about capabilities. Evaluated in application layer only.

### 18.8 Purchase Flow

```
User visits marketing site
         ↓
Purchases via Lemon Squeezy checkout ($79)
         ↓
Lemon Squeezy generates signed license with updatesUntil
         ↓
User receives license.json via email
         ↓
User opens app → imports license file
         ↓
App validates Ed25519 signature (offline)
         ↓
Full access forever + updates for 12 months
```

### 18.9 Renewal Flow

```
User's updatesUntil approaches
         ↓
App shows "Updates expiring soon" notice
         ↓
User clicks "Renew" → marketing site ($39)
         ↓
New license.json with extended updatesUntil
         ↓
User imports new license
         ↓
Updates extended for 12 more months
```

**If user doesn't renew:**
- App keeps working exactly the same
- Just won't receive newer versions
- Can renew anytime to get latest

### 18.10 Licensing Package Structure

```
packages/licensing/
├── src/
│   ├── capabilities.ts   # Capability type + hasCapability()
│   ├── validator.ts      # Ed25519 signature verification
│   ├── storage.ts        # Store/retrieve license locally
│   ├── trial.ts          # Trial state management (14 days)
│   ├── updates.ts        # Update eligibility check
│   ├── types.ts          # Interfaces
│   └── index.ts
├── __tests__/
│   ├── capabilities.test.ts
│   ├── validator.test.ts
│   ├── trial.test.ts
│   └── updates.test.ts
└── package.json
```

---

## 19. Marketing Site

> Static site. Astro. Lemon Squeezy checkout.

### 19.1 Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Astro | Static, fast, simple |
| Styling | Tailwind | Consistent with app |
| Checkout | Lemon Squeezy embed | No backend needed |
| Hosting | Vercel | Free, fast, simple |

### 19.2 Site Structure

```
apps/marketing/
├── src/
│   ├── pages/
│   │   ├── index.astro        # Landing page
│   │   ├── pricing.astro      # Pricing + checkout
│   │   ├── download.astro     # Download links
│   │   └── changelog.astro    # Release notes
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── Features.astro
│   │   ├── PricingCard.astro
│   │   └── Footer.astro
│   ├── layouts/
│   │   └── Base.astro
│   └── styles/
│       └── global.css
├── public/
│   ├── screenshots/
│   └── favicon.ico
├── astro.config.mjs
├── tailwind.config.js
└── package.json
```

### 19.3 Pages

| Page | Purpose |
|------|---------|
| `/` | Landing: hero, features, social proof |
| `/pricing` | Pricing card + Lemon Squeezy checkout |
| `/download` | Download links (Mac, Windows) |
| `/changelog` | Release notes (can pull from GitHub) |

### 19.4 Development Timeline

Marketing site develops **in parallel** with core:

| Core Phase | Marketing Task |
|------------|----------------|
| Phase 1 (Core) | Setup Astro, basic landing |
| Phase 2 (Storage) | Features section, screenshots |
| Phase 3 (IPC) | Pricing page, Lemon Squeezy integration |
| Phase 4 (Desktop) | Download page, final polish |

**Rule:** Marketing site should be ready when desktop shell works.

---

## Checklist Before Coding

### Architecture & Design

- [x] Architecture document complete
- [x] Note model decided (Markdown source of truth)
- [x] Tech stack frozen
- [x] Boundaries defined
- [x] Release & distribution strategy defined
- [x] Documentation system defined (VitePress)
- [x] Observability strategy defined
- [x] Domain versioning strategy defined
- [x] Data ownership & portability defined
- [x] Offline upgrade path defined
- [x] Testing strategy defined
- [x] Non-goals documented
- [x] Monetization strategy defined (subscription, Lemon Squeezy, capabilities)
- [x] Marketing site planned (Astro in monorepo)

### Infrastructure

- [ ] Apple Developer account created
- [ ] Windows signing cert obtained
- [ ] Bootstrap monorepo
- [ ] CI pipeline working

### Core Development

- [ ] First core tests passing
- [ ] SQLite schema created
- [ ] Domain migrations tested

### Storage & Data

- [ ] Data directory setup (OS-specific paths)
- [ ] Backup system implemented
- [ ] Export (Markdown + JSON) working
- [ ] Basic Obsidian import working

### Documentation

- [ ] VitePress docs-site scaffolded
- [ ] ADR-001 (runtime contract) written
- [ ] ADR-002 (markdown model) written
- [ ] ADR-003 (storage) written

### Observability

- [ ] Sentry integration configured
- [ ] Local logging implemented
- [ ] Integrity check on startup

### Monetization

- [ ] Lemon Squeezy account created
- [ ] Subscription product configured (Pro tier)
- [ ] Capabilities system implemented
- [ ] License validation package implemented
- [ ] Trial mode implemented (14 days)
- [ ] Grace period implemented (read-only mode)
- [ ] hasCapability() in application layer
- [ ] "Enter License" UI in app
- [ ] ADR-006 (monetization) written

### Marketing Site

- [ ] Astro project scaffolded
- [ ] Landing page designed
- [ ] Pricing page with Lemon Squeezy checkout
- [ ] Download page
- [ ] Deployed to Vercel

---

## 20. Execution Roadmap

> No time estimates. Just clear milestones.
> Marketing site runs as a parallel track.

### Overview

| Phase | Milestone | Done When |
|-------|-----------|-----------|
| 0 | Bootstrap | `pnpm install` works, CLAUDE.md exists |
| 1 | Core | `pnpm test` passes with note CRUD |
| 2 | Storage | Notes persist in SQLite |
| 3 | Desktop | Window opens, loads notes |
| 4 | Editor | Can create/edit/save markdown |
| 5 | Features | Search, backlinks, tags work |
| 6 | Release | Signed app downloadable |

**Parallel:** Marketing site ready when Phase 3 completes.

---

### Phase 0: Bootstrap

**Goal:** Working monorepo with docs.

**Deliverables:**
- `pnpm install` runs without errors
- `CLAUDE.md` exists at root
- `plan.md` complete
- `docs/marketing-content.md` ready

**Structure:**
```
readied/
├── apps/
│   └── .gitkeep
├── packages/
│   └── .gitkeep
├── docs/
│   └── marketing-content.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── CLAUDE.md
├── plan.md
├── .gitignore
└── .nvmrc
```

---

### Phase 1: Core

**Goal:** Domain logic testable in pure Node.

**Deliverables:**
- `packages/core` with Note entity
- Operations: createNote, updateNote, deleteNote
- Tests passing with Vitest

**Done when:** `pnpm --filter @readied/core test` passes.

---

### Phase 2: Storage

**Goal:** SQLite adapter with migrations.

**Deliverables:**
- `packages/storage` with better-sqlite3
- NoteRepository implementing core ports
- Migration runner + initial schema

**Done when:** Notes CRUD works against real SQLite.

---

### Phase 3: Desktop

**Goal:** Electron app that opens.

**Deliverables:**
- `apps/desktop` with electron-vite
- Main process with SQLite
- Preload with IPC bridge
- Renderer with React

**Done when:** App opens, loads notes from SQLite.

**Parallel:** Marketing site should be ready now.

---

### Phase 4: Editor

**Goal:** CodeMirror 6 editing notes.

**Deliverables:**
- CodeMirror 6 integration
- NoteEditor component
- Save on change
- Markdown syntax highlighting

**Done when:** Can create, edit, and save notes.

---

### Phase 5: Features

**Goal:** MVP feature set.

**Deliverables:**
- Note list (sidebar)
- Search (LIKE-based)
- Tags (from frontmatter)
- Backlinks (wikilinks)
- Keyboard shortcuts

**Done when:** Usable as daily note app.

---

### Phase 6: Release

**Goal:** Signed, auto-updating app.

**Deliverables:**
- GitHub Actions workflow
- electron-builder config
- Code signing (Mac + Windows)
- Auto-update feed

**Done when:** v0.1.0 downloadable and installable.

---

## Repository

**Product name:** Readied
**NPM scope:** `@readied/*`
**GitHub:** https://github.com/tomymaritano/readide.git (consider renaming to `readied`)

**Clone:**
```bash
git clone https://github.com/tomymaritano/readide.git readied
cd readied
pnpm install
```
