## [0.9.1](https://github.com/tomymaritano/readide/compare/v0.9.0...v0.9.1) (2026-03-16)

### Bug Fixes

- re-merge develop with proper merge commit for semantic-release ([#161](https://github.com/tomymaritano/readide/issues/161)) ([fa5306d](https://github.com/tomymaritano/readide/commit/fa5306d4db7ece94bb4a287a2591f1f29bf7aa25)), closes [#160](https://github.com/tomymaritano/readide/issues/160)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Notas sobre Versiones Tempranas

- **v0.1.0**: Tag de infraestructura inicial (CI/CD setup, no release funcional)
- **v0.1.1+**: Releases funcionales con producto utilizable

---

## [0.9.0] - 2026-03-13

### Added

#### Website

- Full website redesign with shadcn/ui + Magic UI

#### Auth

- Auth UX rethink with Enable Sync flow
- Auth middleware fix: return 401 instead of 500 on invalid tokens

#### Sync

- Error propagation for sync failures
- Exponential backoff on retry
- Abort sync on logout
- Typed token refresh
- Sync onboarding prompt after 5 notes
- Offline queue visibility in the UI

#### AI Commands (Cmd+K v1)

- Command panel for AI interactions
- AI settings configuration
- Keybindings for AI commands

#### AI Knowledge (Cmd+K v2)

- RAG-based knowledge retrieval
- Ask Notes: query your own notes with AI
- Related context suggestions

#### AI Extensibility

- Plugin API for AI commands
- Presets import/export

#### Documentation

- API documentation

---

## [0.1.2] - 2026-01-01

### Fixed

- Exclude builder-debug.yml from release artifacts

## [0.1.1] - 2026-01-01

### Added

- Logging system with Pino
- TanStack Query for data management
- Data management: backup, export, import
- Licensing package for monetization
- VitePress documentation site

### Changed

- UX polish and visual improvements

## [0.1.0] - 2026-01-01

### Added

- Initial project infrastructure
- CI/CD workflows
- Electron + Vite setup
- Basic note editing with CodeMirror 6
