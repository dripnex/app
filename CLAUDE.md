# Readied

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
  marketing/         # Astro landing site
packages/
  core/              # Domain logic + markdown parsing
  storage/           # SQLite adapter + migrations
  ipc-contract/      # Typed IPC channels (Zod)
  licensing/         # License validation
  ui-kit/            # React components + design tokens
```

## Commands

```bash
pnpm install                    # Install dependencies
pnpm dev                        # Run desktop in dev mode
pnpm test                       # Run all tests
pnpm build                      # Build for production
pnpm --filter @readied/core test  # Test specific package
```

## Key Rules

- **Markdown is sacred:** Never auto-modify user's markdown text
- **AST is ephemeral:** Parse for features, never persist as authority
- **Core is pure:** No Electron/React deps in packages/core
- **Offline-first:** No features require internet connection
- **Test first:** Core domain changes require tests

## Architecture Decisions

All frozen decisions documented in `plan.md`. Key points:

- Source of truth = raw Markdown text (not AST)
- Monetization = Perpetual license + maintenance ($79 + updates)
- 5 packages for v0.1 (simplified from 9)

## Docs

- `plan.md` — Full architecture document
- `docs/marketing-content.md` — Marketing site copy
- `packages/*/README.md` — Package-specific docs
