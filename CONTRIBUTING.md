# Contributing to Dripnex

Thank you for your interest in contributing to Dripnex!

## What Can I Contribute To?

Dripnex uses an **Open Core** model:

### Open Source (MIT) - Contributions Welcome!

| Package                   | Description                       |
| ------------------------- | --------------------------------- |
| `packages/core`           | Markdown parsing, note operations |
| `packages/storage-core`   | Storage interfaces                |
| `packages/storage-sqlite` | SQLite implementation             |
| `packages/wikilinks`      | Wikilink parsing                  |
| `packages/commands`       | Command palette                   |
| `packages/embeds`         | Image/embed handling              |
| `packages/plugin-api`     | Plugin API + theme system         |

### Proprietary - Not Open for Contributions

- `apps/desktop` - The desktop application
- `packages/licensing` - License validation

## How to Contribute

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/readide.git
cd readide
pnpm install
```

### 2. Create a Branch

```bash
git checkout -b feat/your-feature
# or
git checkout -b fix/your-bugfix
```

### 3. Make Changes

- Follow existing code style
- Add tests for new functionality
- Run `pnpm test` before committing
- Run `pnpm typecheck` to verify types

### 4. Commit

Use conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
test: add tests
refactor: code cleanup
```

### 5. Submit PR

- Open a Pull Request against `main`
- Describe your changes clearly
- Link any related issues

## Development Setup

```bash
pnpm install          # Install dependencies
pnpm dev              # Run desktop app in dev mode
pnpm test             # Run tests
pnpm typecheck        # Check TypeScript
pnpm build            # Build all packages
```

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn

## Questions?

- Open a [GitHub Discussion](https://github.com/dripnex/readide/discussions)
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed
under the MIT License (for open source packages).
