# Contributing to Dripnex

Thanks for your interest in contributing!

## Getting Started

1. Fork and clone the repo
2. Run `pnpm install` to install dependencies
3. Run `pnpm dev` to start the desktop app in dev mode

## Development

```bash
pnpm dev          # Run desktop in dev mode
pnpm test         # Run tests
pnpm typecheck    # TypeScript validation
pnpm lint         # ESLint
pnpm format       # Prettier formatting
```

## Finding Issues

- Look for issues labeled [`good first issue`](https://github.com/dripnex/readide/labels/good%20first%20issue) for beginner-friendly tasks
- Issues labeled [`help wanted`](https://github.com/dripnex/readide/labels/help%20wanted) are open for community contributions

## Pull Requests

- Branch from `develop` (not `main`)
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Ensure `pnpm test` and `pnpm typecheck` pass
- Target `develop` branch for PRs

## Project Structure

```
apps/desktop/      # Electron app
apps/docs-site/    # VitePress documentation
apps/marketing-site/ # Astro marketing pages
packages/          # Shared packages (core, storage, plugins, etc.)
```

## Need Help?

- Open a [Discussion](https://github.com/dripnex/readide/discussions)
- Check the [Documentation](https://dripnex.github.io/readide/)
