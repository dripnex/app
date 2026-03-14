# Readied

Markdown-first, offline-forever desktop note app.

[![License: MIT](https://img.shields.io/badge/Core-MIT-green.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/tomymaritano/readide)](https://github.com/tomymaritano/readide/releases)

## About

This repository contains the **open-source core** of Readied. Core packages are licensed under MIT for community use and contributions. The desktop application and some commercial features remain proprietary.

## Quick Start

```bash
# Clone
git clone https://github.com/tomymaritano/readide.git
cd readide

# Install
pnpm install

# Run
pnpm dev
```

## Open Source Packages

| Package                   | Description                    |
| ------------------------- | ------------------------------ |
| `@readied/core`           | Domain logic, markdown parsing |
| `@readied/storage-core`   | Storage interfaces             |
| `@readied/storage-sqlite` | SQLite implementation          |
| `@readied/wikilinks`      | Wikilink parsing               |
| `@readied/tasks`          | Task/checkbox parsing          |
| `@readied/commands`       | Command palette                |
| `@readied/embeds`         | Image/embed handling           |
| `@readied/plugin-api`     | Plugin API + theme system      |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Links

- [Website](https://readied.app)
- [Documentation](https://tomymaritano.github.io/readide/)
- [Releases](https://github.com/tomymaritano/readide/releases)

## License

- **Core packages:** MIT License
- **Desktop app:** Proprietary

See [LICENSE](./LICENSE) for details.
