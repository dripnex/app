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
  docs-site/         # VitePress documentation
packages/
  core/              # Domain logic + markdown parsing
  storage-core/      # Storage interfaces (pure TS)
  storage-sqlite/    # SQLite adapter (peerDep for better-sqlite3)
  licensing/         # License validation
  product-config/    # Product configuration
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
4. `pnpm build && pnpm --filter @readied/desktop dist:mac` — Build for production

## Documentation

- **Architecture decisions:** `plan.md`
- **Package docs:** `packages/*/README.md`
- **Technical docs:** `apps/docs-site/`
- **Live docs:** https://tomymaritano.github.io/readide/
- **GitHub:** https://github.com/tomymaritano/readide
