# Getting Started

Readied is a Markdown-first, offline-forever desktop note app for developers.

## Installation

Download the latest release from [GitHub Releases](https://github.com/tomymaritano/readide/releases).

| Platform              | Download                        |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `Readied-x.x.x-arm64.dmg`       |
| macOS (Intel)         | `Readied-x.x.x.dmg`             |
| Windows               | `Readied.Setup.x.x.x.exe`       |
| Linux (AppImage)      | `Readied-x.x.x-x86_64.AppImage` |
| Linux (Debian)        | `Readied-x.x.x-amd64.deb`       |

## First Launch

1. Open Readied
2. Your notes are stored locally in:
   - **macOS**: `~/Library/Application Support/Readied/`
   - **Windows**: `%APPDATA%/Readied/`
   - **Linux**: `~/.config/Readied/`
3. Start writing in Markdown!

## Key Features

### Markdown First

- Full Markdown syntax support
- Syntax highlighting for code blocks
- Your markdown is **never auto-modified**

### Offline Forever

- No account required
- No internet connection needed
- Your data stays on your machine

### Import & Export

- Import from Obsidian vaults
- Import plain Markdown folders
- Export to Markdown + JSON

## Development

```bash
# Clone the repository
git clone https://github.com/tomymaritano/readide.git readied
cd readied

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build
```

## Next Steps

- Read the [Principles](/guide/principles) to understand the philosophy
- Explore the [Architecture](/architecture/overview) to understand how it works
- Check the [ADRs](/decisions/) for key technical decisions
