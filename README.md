# Dripnex

Markdown-first, offline-first desktop note app.

This repository is the **Dripnex desktop/product monorepo**: the Electron app plus shared TypeScript packages.

[![License: MIT](https://img.shields.io/badge/Core-MIT-green.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/dripnex/app)](https://github.com/dripnex/app/releases)

## What this is

Dripnex stores notes as **standard Markdown files on disk**. The default is local and offline: the editor and your files do not require a network connection.

Plugins and themes are **not** shipped as extra trees inside this repo. Official packs live in their own GitHub repositories under [`github.com/dripnex`](https://github.com/dripnex), named `plugin-*` and `theme-*`.

### License (open core)

As documented in [LICENSE](./LICENSE):

- **MIT:** listed core packages (markdown/domain logic, storage interfaces, plugin API, and related libraries)
- **Proprietary:** `apps/desktop` (the desktop application) and `packages/licensing`

See [LICENSE](./LICENSE) for the package list. Some other packages also declare MIT in their own `package.json`; treat LICENSE as the dual-license source of truth.

## How to run

**Requirements** (from root `package.json`): Node.js `>= 20` and pnpm `>= 9`. The repo pins `packageManager` to `pnpm@9.15.1`. CI currently uses Node 22.

```bash
git clone https://github.com/dripnex/app.git
cd app
pnpm install
pnpm dev
```

`pnpm dev` is `turbo dev`. It starts every workspace package that defines a `dev` script. Today that includes:

- `apps/desktop` — Electron app (`electron-vite dev`)
- `packages/api` — Wrangler (cloud API; not required to edit notes locally)
- `packages/mcp-server` — local MCP stdio server

To run **only** the desktop app:

```bash
pnpm --filter @dripnex/desktop dev
```

Other root scripts:

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm test`      | Tests, excluding `@dripnex/storage-sqlite`                |
| `pnpm typecheck` | TypeScript across the workspace                           |
| `pnpm lint`      | ESLint                                                    |
| `pnpm format`    | Prettier                                                  |
| `pnpm build`     | Production build via Turbo                                |

`pnpm test` skips `storage-sqlite` on purpose: that package's native `better-sqlite3` binary is built for Electron, not for a plain Node test run. CI runs those tests in a clean Node environment.

Native modules belong in `apps/desktop`. The desktop `postinstall` script runs `electron-builder install-app-deps`. Do not add native dependencies to workspace packages.

The default git branch is `develop`. Feature work branches from there, not from `main`.

## How to contribute

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

**Pull requests**

- Branch from `develop` (`feat/...` or `fix/...`).
- Open the PR against **`develop`**, not `main`. The [PR template](./.github/PULL_REQUEST_TEMPLATE.md) checks this.
- Use conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Run `pnpm test` and `pnpm typecheck` before you open the PR.

`main` is for production releases. Do not send product PRs there.

**What to change in this repo**

Contributions to the MIT packages listed in [LICENSE](./LICENSE) are welcome. `apps/desktop` and `packages/licensing` are proprietary.

**Plugins and themes**

Do not add community plugins or themes to this monorepo. Put them in their own git repo:

| Kind   | Naming              | Examples                                                                                         |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------ |
| Plugin | `dripnex/plugin-*`  | [plugin-vim](https://github.com/dripnex/plugin-vim), [plugin-mermaid](https://github.com/dripnex/plugin-mermaid), [plugin-math](https://github.com/dripnex/plugin-math), [plugin-stamp](https://github.com/dripnex/plugin-stamp) |
| Theme  | `dripnex/theme-*`   | [theme-parchment](https://github.com/dripnex/theme-parchment), [theme-harbor-dusk](https://github.com/dripnex/theme-harbor-dusk) |

Browse the org: [plugins](https://github.com/orgs/dripnex/repositories?q=plugin-), [themes](https://github.com/orgs/dripnex/repositories?q=theme-).

From this repo you can scaffold a local pack (`pnpm plugin init "My Plugin"` or `pnpm plugin init "Paper" --type theme`). Install/load details: [docs/plugins/](./docs/plugins/README.md) and [docs/PLUGIN_SYSTEM.md](./docs/PLUGIN_SYSTEM.md).

A few built-ins (for example tables) still live in the desktop app. That is separate from satellite `plugin-*` / `theme-*` repos.

## Layout

```
apps/desktop/    Electron app (main, preload, renderer) — proprietary
packages/        Shared libraries (MIT packages listed in LICENSE, plus others)
```

Workspace globs are `apps/desktop` and `packages/*` (`pnpm-workspace.yaml`). Marketing and the public docs site live in other repositories (`dripnex/marketing`, `dripnex/docs-site`), not here.

## Links

- [Website](https://dripnex.app)
- [Documentation](https://dripnex.app/docs)
- [Releases](https://github.com/dripnex/app/releases)
- [Issues](https://github.com/dripnex/app/issues)
- [Security](./SECURITY.md)
