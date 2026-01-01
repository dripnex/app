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
  docs-site/         # Documentation site
packages/
  core/              # Domain logic + markdown parsing
  storage-core/      # Storage interfaces (pure TS)
  storage-sqlite/    # SQLite adapter (uses peerDep for better-sqlite3)
  licensing/         # License validation
  product-config/    # Product configuration
```

## Commands

```bash
pnpm install                    # Install dependencies
pnpm dev                        # Run desktop in dev mode
pnpm test                       # Run tests (excludes storage-sqlite)
pnpm build                      # Build for production
pnpm --filter @readied/core test  # Test specific package
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
    "better-sqlite3": "^11.7.0"  // For local dev/tests only
  }
}
```

```json
// apps/desktop/package.json
{
  "dependencies": {
    "better-sqlite3": "^11.7.0"  // The actual dependency
  }
}
```

## Architecture Decisions

All frozen decisions documented in `plan.md`. Key points:

- Source of truth = raw Markdown text (not AST)
- Monetization = Perpetual license + maintenance ($79 + updates)
- 5 packages for v0.1 (simplified from 9)

## Development Workflow

1. **Run dev mode**: `pnpm dev` from monorepo root
2. **Test before commit**: `pnpm test` for all packages
3. **Typecheck**: `pnpm typecheck` validates all TypeScript
4. **Build for production**: `pnpm build` then `pnpm --filter @readied/desktop dist:mac`

## Packaging

```bash
# Build and package for macOS
pnpm --filter @readied/desktop build
pnpm --filter @readied/desktop dist:mac

# The postinstall script handles native module rebuilding automatically
```

## Testing con Native Modules

### Regla de Oro

`@readied/storage-sqlite` NO se testea en Node después de compilar para Electron.

### Comandos de test

- `pnpm test` - Ejecuta todos los tests EXCEPTO storage-sqlite (seguro siempre)
- Los tests de storage-sqlite se ejecutan solo en CI con Node.js limpio

### Por que?

`better-sqlite3` es un modulo nativo. El binario compilado para Electron != binario para Node.js.
No hay forma de tener ambos en el mismo `node_modules`.

### Si necesitas testear storage-sqlite localmente

1. Acepta que la app Electron dejara de funcionar despues
2. `cd packages/storage-sqlite && pnpm rebuild better-sqlite3 && pnpm test`
3. `pnpm dev` para volver a compilar para Electron

## Docs

- `plan.md` — Full architecture document
- `packages/*/README.md` — Package-specific docs
