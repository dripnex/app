# Getting Started

Readied is a Markdown-first desktop note app for developers who value their data.

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

### Notebooks

- Organize notes into hierarchical notebooks
- Drag and drop notes between notebooks
- Collapse and expand notebook trees in the sidebar

### Wikilinks

- Link between notes with `[[wikilink]]` syntax
- Backlinks panel shows all notes that reference the current note
- Quick navigation between linked notes

### Plugin System

- 8 built-in plugins covering core editing and productivity features
- Extensible architecture for community plugins
- Load custom plugins from `~/.config/readied/plugins`
- Plugins can extend the editor, sidebar, and command palette

### Optional Cloud Sync

- Supabase-based sync across devices
- Magic link authentication (no passwords)
- End-to-end encryption for synced notes
- Works 100% offline by default — sync is opt-in

### Theme System

- Customizable color palettes with dark/light awareness
- Ships with Solarized theme built-in
- Themes adapt automatically to system appearance

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
