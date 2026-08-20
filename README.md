# Dripnex

Markdown-first, offline-forever desktop note app.

[![License: MIT](https://img.shields.io/badge/Core-MIT-green.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/dripnex/app)](https://github.com/dripnex/app/releases)

## About

This repository contains the **open-source core** of Dripnex. Core packages are licensed under MIT for community use and contributions. The desktop application and some commercial features remain proprietary.

## Quick Start

```bash
# Clone
git clone https://github.com/dripnex/app.git
cd app

# Install
pnpm install

# Run
pnpm dev
```

## Open Source Packages

| Package                   | Description                    |
| ------------------------- | ------------------------------ |
| `@dripnex/core`           | Domain logic, markdown parsing |
| `@dripnex/storage-core`   | Storage interfaces             |
| `@dripnex/storage-sqlite` | SQLite implementation          |
| `@dripnex/wikilinks`      | Wikilink parsing               |
| `@dripnex/commands`       | Command palette                |
| `@dripnex/embeds`         | Image/embed handling           |
| `@dripnex/plugin-api`     | Plugin API + theme system      |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Links

- [Website](https://dripnex.app)
- [Documentation](https://dripnex.app/docs)
- [Releases](https://github.com/dripnex/app/releases)

## License

- **Core packages:** MIT License
- **Desktop app:** Proprietary

See [LICENSE](./LICENSE) for details.
