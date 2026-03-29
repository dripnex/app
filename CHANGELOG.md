## [0.11.0](https://github.com/tomymaritano/readide/compare/v0.10.0...v0.11.0) (2026-03-29)

### Features

- sync E2EE, deep link auth, auto-trial, docs cleanup ([#179](https://github.com/tomymaritano/readide/issues/179)) ([77928a6](https://github.com/tomymaritano/readide/commit/77928a664fef6df9f4339881b929bccf50c2686b))

### Bug Fixes

- **ci:** bust corrupted electron-builder cache for Linux build ([a83ae07](https://github.com/tomymaritano/readide/commit/a83ae0734452f988cc9219ba89907a78de4d2359))
- **ci:** clean fpm cache before Linux build to fix 7zip extraction error ([c206148](https://github.com/tomymaritano/readide/commit/c2061487f42f51cbcc745bd23c1734db21577f1c))
- **mcp:** add sql.js type declarations for CI build ([37ef5e9](https://github.com/tomymaritano/readide/commit/37ef5e9e4f94ad384f63b17cfa707e5651017f49))

## [0.10.0](https://github.com/tomymaritano/readide/compare/v0.9.1...v0.10.0) (2026-03-20)

### Features

- AI providers, dashboard, settings refresh, production fixes ([#172](https://github.com/tomymaritano/readide/issues/172)) ([36707e7](https://github.com/tomymaritano/readide/commit/36707e73e2f9c17a8972ee5896355823090edfbd))

### Bug Fixes

- regenerate lockfile with marked dependency ([11b4167](https://github.com/tomymaritano/readide/commit/11b4167d5a385ef97bb404f77dbf227cceba45bf))
- **web:** add marked dependency for shared note markdown rendering ([f35e055](https://github.com/tomymaritano/readide/commit/f35e055e52c87c6a4271baf2b80bbba1046b7dc8))
- **web:** release develop to main — cleanUrls auth/verify 404 fix ([#167](https://github.com/tomymaritano/readide/issues/167)) ([bbb12e1](https://github.com/tomymaritano/readide/commit/bbb12e19f6287815270af8e7af2ceee525496f6f))
- **web:** render shared notes as markdown + webhook fixes ([#170](https://github.com/tomymaritano/readide/issues/170)) ([f026b85](https://github.com/tomymaritano/readide/commit/f026b8544ae41e5115f21873cada588e43d7f5cf))

## [0.9.1](https://github.com/tomymaritano/readide/compare/v0.9.0...v0.9.1) (2026-03-16)

### Bug Fixes

- re-merge develop with proper merge commit for semantic-release ([#161](https://github.com/tomymaritano/readide/issues/161)) ([fa5306d](https://github.com/tomymaritano/readide/commit/fa5306d4db7ece94bb4a287a2591f1f29bf7aa25)), closes [#160](https://github.com/tomymaritano/readide/issues/160)

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
