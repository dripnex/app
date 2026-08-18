# Dripnex

> Markdown-first, offline-forever desktop note app.

## Stack

- **Runtime:** Electron + electron-vite
- **Frontend:** React + TanStack Query + Zustand
- **Editor:** CodeMirror 6
- **Database:** SQLite (better-sqlite3)
- **Monorepo:** pnpm + turborepo

## Structure

```
apps/
  desktop/           # Electron app (main, preload, renderer)
  web/               # Next.js marketing site + docs
packages/
  ai-core/           # Provider-agnostic AI: streaming, LLM providers, context builder
  core/              # Domain logic + markdown parsing
  command-registry/  # Command palette registry
  plugin-api/        # Plugin system interfaces
  storage-core/      # Storage interfaces (pure TS)
  storage-sqlite/    # SQLite adapter (peerDep for better-sqlite3)
  licensing/         # License validation
  product-config/    # Product configuration
  sync-core/         # Sync engine
```

## Commands

```bash
pnpm install                    # Install dependencies
pnpm dev                        # Run desktop in dev mode
pnpm test                       # Run tests (excludes storage-sqlite)
pnpm build                      # Build for production
pnpm typecheck                  # Validate TypeScript
pnpm lint                       # Run ESLint
pnpm format                     # Format with Prettier
```

## Key Rules

- **Markdown is sacred:** Never auto-modify user's markdown text
- **AST is ephemeral:** Parse for features, never persist as authority
- **Core is pure:** No Electron/React deps in packages/core
- **Offline-first:** No features require internet connection
- **Test first:** Core domain changes require tests

## Native Dependencies (Critical)

Native modules like `better-sqlite3` require special handling in Electron + pnpm workspaces:

- **Native deps only in `apps/desktop`**: Never add native dependencies directly to workspace packages
- **Workspace packages = pure TypeScript**: Use `peerDependencies` for native modules
- **electron-builder owns the rebuild**: Let `postinstall: electron-builder install-app-deps` handle native module compilation
- **No manual rebuilds**: Never add `@electron/rebuild` scripts or workarounds

Pattern for workspace packages with native deps:

```json
// packages/storage-sqlite/package.json
{
  "peerDependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "better-sqlite3": "^11.7.0"
  }
}
```

## Type Version Alignment

Each app manages its own `@types/react` version: `apps/desktop` uses React 18 types and `apps/web` uses React 19 types. Global overrides were removed to prevent cross-app type conflicts.

**If you see `'X' cannot be used as a JSX component` errors:** Check that each app's `package.json` pins `@types/react` to match its React version.

## Testing

- `pnpm test` runs all tests **except** storage-sqlite (safe to run always)
- storage-sqlite tests run only in CI with clean Node.js environment
- **Why:** `better-sqlite3` binary compiled for Electron ≠ Node.js binary

To test storage-sqlite locally (breaks Electron app until `pnpm dev`):

```bash
cd packages/storage-sqlite && pnpm rebuild better-sqlite3 && pnpm test
```

## Development Workflow

1. `pnpm dev` — Run desktop in development mode
2. `pnpm test` — Test before committing
3. `pnpm typecheck` — Validate TypeScript
4. `pnpm build && pnpm --filter @dripnex/desktop dist:mac` — Build for production

## Git Flow

We use a simplified Git Flow with automated releases:

```
main          ← Production releases (semantic-release runs here)
  └── develop ← Integration branch (NEVER push directly)
        └── feature/* ← Feature development
        └── fix/*     ← Bug fixes
```

### Branches

| Branch      | Purpose                   | Merges to       |
| ----------- | ------------------------- | --------------- |
| `main`      | Production releases       | -               |
| `develop`   | Integration, next release | `main` (via PR) |
| `feature/*` | New features              | `develop`       |
| `fix/*`     | Bug fixes                 | `develop`       |

### Branch Protection Rules (MANDATORY)

- **NEVER commit directly to `develop` or `main`** — always create a feature/fix branch first
- **All work goes through PRs** — even small fixes, even single-line changes
- **PR flow:** `feature/*` or `fix/*` → `develop` (via PR) → `main` (via PR)
- **Branch naming:** `feature/short-description` for new features, `fix/short-description` for bug fixes

**Claude Code MUST follow this workflow:**

1. `git checkout develop && git pull origin develop`
2. `git checkout -b fix/description-here` (or `feature/`)
3. Make changes, commit on the branch
4. `git push -u origin fix/description-here`
5. `gh pr create --base develop --head fix/description-here`
6. After merge: `git checkout develop && git pull && git branch -d fix/description-here`

**NEVER do:** `git commit` on develop, `git push origin develop`, `gh pr create --base main --head develop` (unless releasing)

### Release Process (Automated)

1. PR from `develop` to `main` — CI validates
2. Click **"Run workflow"** on the **Release** action (`workflow_dispatch`)
3. semantic-release analyzes commits, bumps version, creates tag + draft GitHub Release
4. Tag push triggers Build workflow — builds mac/win/linux in parallel
5. All builds succeed → Release is undrafted → electron-updater picks it up
6. Auto-PR syncs main back to develop

**Manual steps: 2** (merge PR + click Release)

### Rollback

```bash
# Soft rollback — stop distribution immediately
gh release edit v0.10.0 --draft

# Hard rollback — delete entirely
gh release delete v0.10.0 --yes
git push --delete origin v0.10.0
```

### Workflow

**Starting new work:**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

**Keep branch in sync (do this daily or before pushing):**

```bash
git fetch origin develop
git rebase origin/develop
```

**Creating PR:**

```bash
git push -u origin feature/my-feature
gh pr create --base develop --head feature/my-feature
```

**After PR merged:**

```bash
git checkout develop
git pull origin develop
git branch -d feature/my-feature
```

### Branch Hygiene (Critical)

Long-lived branches cause painful merge conflicts. Follow these rules:

- **Always branch from develop:** `git checkout develop && git pull && git checkout -b fix/my-fix`
- **Never push to develop directly:** All changes via PR from feature/fix branches
- **Rebase daily:** `git fetch origin develop && git rebase origin/develop` before starting work each day
- **Small PRs:** Prefer 3 small PRs over 1 large one. Split by layer (types → logic → UI)
- **Max branch lifetime:** 2-3 days. If work takes longer, split into incremental PRs
- **Don't touch unrelated files:** Avoid changes to `package.json`, lockfiles, or `apps/web` unless that's the PR's purpose — these are high-conflict files
- **Rebase before pushing:** Always rebase against latest develop before `git push` to catch conflicts early
- **Clean up after merge:** Delete feature branches locally and remotely after PR is merged

### Commit Messages

Use conventional commits:

- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code refactoring
- `docs:` — Documentation
- `test:` — Tests
- `chore:` — Maintenance

### PR Requirements

- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] PR targets `develop` (not `main`)
- [ ] Descriptive title with conventional commit prefix
- [ ] Summary of changes in description

## Pricing/Copy Changes

**Source of Truth:** `packages/product-config/src/facade.ts`

All pricing, plans, and guarantees live in ONE place. Marketing pages consume it.

**Golden Rule:** If the business model changes, one PR must touch:

1. `packages/product-config/src/facade.ts` — Update SoT
2. Marketing pages that consume facade — Auto-updated via import
3. `terms.astro` + `privacy.astro` — Align vocabulary manually

**Pages consuming facade:**

- `pricing.astro` ✅
- `faq.astro` ✅
- `Hero.astro` ✅
- `Audience.astro` ✅

**Legal pages checklist (before merge):**

- [ ] Model matches facade? (free vs subscription)
- [ ] "Free tier" and "Pro" used consistently?
- [ ] Trial days = `config.trialDays`?
- [ ] Refund days = 14?

## Navigation Architecture

The app uses a centralized `NavigationState` for all navigation concerns.

**Source of Truth:** `hooks/useNavigation.tsx`

```tsx
type NavigationState =
  | { kind: 'global'; filter: 'all' | 'pinned' | 'trash' }
  | { kind: 'notebook'; id: string }
  | { kind: 'tag'; name: string } // Future
  | { kind: 'search'; query: string }; // Future
```

**Key Principles:**

- One state rules all navigation
- All filtering derived from `NavigationState`
- Sidebar emits navigation actions, never filters data
- UI = pure function of state

**How it works:**

1. `NavigationProvider` wraps the app
2. `useNavigation()` provides state + actions
3. `filteredNotes` is derived automatically
4. Sidebar calls `goToNotebook()`, `goToAllNotes()`, etc.
5. No props drilling for navigation

**Adding new views (Tags, Smart Folders):**

```tsx
// 1. Add to NavigationState type
| { kind: 'tag'; name: string }

// 2. Add action to useNavigation
const goToTag = useCallback((name: string) => {
  setNavigation({ kind: 'tag', name });
}, []);

// 3. Add filter case in filteredNotes useMemo
case 'tag':
  notes = notes.filter(n => n.tags?.includes(navigation.name));
  break;
```

**PR Checklist (navigation changes):**

- [ ] State change via actions only (`goToX()`)
- [ ] Filtering in `useNavigation.tsx` only
- [ ] Sidebar uses `useNavigation()` hook
- [ ] No implicit flags (`!== null`)

## AI Architecture

The AI system lives in `packages/ai-core` with a provider-agnostic, streaming-first design.

```
Renderer (AiPanel) → IPC → Main (ipc-ai.ts) → AIService → ProviderRegistry → Provider → SSE stream
                   ← batched LLMEvents (text/error/done) ←
```

**Key packages and files:**

- `packages/ai-core/` — LLMProvider interface, ProviderRegistry, AnthropicProvider, ContextBuilder, AIService
- `apps/desktop/src/main/ai/ipc-ai.ts` — IPC bridge, 50ms batched event streaming
- `apps/desktop/src/preload/index.ts` — `window.dripnex.ai` API (chat, onEvent, cancel)
- `apps/desktop/src/renderer/components/ai/AiPanel.tsx` — Chat UI with streaming

**Adding a new LLM provider:**

1. Create `packages/ai-core/src/providers/my-provider.ts` implementing `LLMProvider`
2. Register in `ProviderRegistry` at `apps/desktop/src/main/ai/ipc-ai.ts`
3. Add option to `apps/desktop/src/renderer/pages/settings/sections/AiSection.tsx`

**Key types:**

- `LLMEvent` — Protocol: `text` (delta), `error` (with code), `done`, `tool_call`, `tool_result`
- `ChatOptions` — Provider, model, messages, tools, maxTokens
- `LLMProvider` — `chat(options): AsyncGenerator<LLMEvent>` + `models()` + `validateKey()`

**Rules:**

- **No SDK dependencies in ai-core:** Providers use native `fetch` + SSE parsing
- **Streaming only:** No request/response pattern — everything streams via `LLMEvent`
- **Single panel instance:** Both Cmd+K and Sparkles button toggle the same AiPanel in App.tsx via CustomEvent (`dripnex:ai:toggle-panel`)
- **Settings store is source of truth:** API key, model, and provider come from Zustand settings store (`selectAi` selector), not plugin config

## Documentation

- **Architecture decisions:** `plan.md`
- **Package docs:** `packages/*/README.md`
- **Technical docs:** `apps/docs-site/`
- **Live docs:** https://dripnex.app/docs
- **GitHub:** https://github.com/dripnex/readide
