# Contributing to Dripnex

Thank you for your interest in contributing.

This file is the contribution guide for **this repository** (`dripnex/app`). Plugins and themes belong in their own git repos — see below.

## What you can contribute here

Dripnex uses an **open-core** model, as documented in [LICENSE](./LICENSE).

### Open source (MIT)

The MIT packages listed in LICENSE. In this tree that includes:

| Path                      | Role                              |
| ------------------------- | --------------------------------- |
| `packages/core`           | Domain logic, markdown parsing    |
| `packages/storage-core`   | Storage interfaces                |
| `packages/storage-sqlite` | SQLite adapter                    |
| `packages/wikilinks`      | Wikilink parsing                  |
| `packages/commands`       | Command palette logic             |
| `packages/embeds`         | Embed handling                    |
| `packages/plugin-api`     | Plugin API and theme system       |
| `packages/product-config` | Product configuration             |

LICENSE also names `packages/tasks/`; that directory is not in the tree today.

### Proprietary — not open for contributions

- `apps/desktop` — desktop application
- `packages/licensing` — license validation

LICENSE also names `apps/marketing-site/`; marketing lives in a separate repo, not this monorepo.

### Plugins and themes — separate repositories

Do **not** add community plugins or themes to this monorepo.

Official packs are their own GitHub repositories under [github.com/dripnex](https://github.com/dripnex):

- Plugins: `plugin-*` (for example [plugin-vim](https://github.com/dripnex/plugin-vim))
- Themes: `theme-*` (for example [theme-parchment](https://github.com/dripnex/theme-parchment))

To scaffold a local pack from this repo:

```bash
pnpm plugin init "My Plugin"
pnpm plugin init "Paper" --type theme
```

See [docs/plugins/](./docs/plugins/README.md) and [docs/PLUGIN_SYSTEM.md](./docs/PLUGIN_SYSTEM.md).

## How to contribute

### 1. Fork and clone

```bash
git clone https://github.com/YOUR_USERNAME/app.git
cd app
pnpm install
```

Requirements: Node.js `>= 20` and pnpm `>= 9` (root `package.json`).

### 2. Branch from `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feat/your-feature
# or
git checkout -b fix/your-bugfix
```

The default branch is `develop`. Do not branch from `main` for product work.

### 3. Make changes

- Follow existing code style
- Add tests for new functionality in MIT packages
- Run `pnpm test` and `pnpm typecheck` before committing

`pnpm test` excludes `@dripnex/storage-sqlite` (native module / Electron vs Node). That is expected.

### 4. Commit

Use conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
test: add tests
refactor: code cleanup
chore: maintenance
```

### 5. Open a pull request

- Target **`develop`**, not `main`
- Describe the change and link related issues
- Use the [PR template](./.github/PULL_REQUEST_TEMPLATE.md)

`main` is for production releases only.

## Development commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Turbo `dev` (desktop + any other package `dev` scripts)
pnpm --filter @dripnex/desktop dev   # Desktop app only
pnpm test             # Tests (excludes storage-sqlite)
pnpm typecheck        # TypeScript
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm build            # Build all packages
```

More context: [README.md](./README.md).

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Questions?

- Check existing [issues](https://github.com/dripnex/app/issues) before opening a new one
- Security reports: [SECURITY.md](./SECURITY.md) (do not file a public issue)

## License

By contributing to the MIT packages, you agree that your contributions are licensed under the MIT License, as stated in [LICENSE](./LICENSE).
