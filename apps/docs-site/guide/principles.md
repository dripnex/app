# Principles

These principles guide every technical and product decision in Readied.

## Core Principles

### 1. Markdown is Sacred

> "If the user typed it, we keep it."

- User-typed markdown is **NEVER** auto-modified
- No normalization of whitespace, headings, or lists
- No auto-fix for broken links
- No "prettify markdown" feature
- Export = exact copy of stored markdown

### 2. Offline First

- 100% functional without internet connection
- Sync is a feature, not a requirement
- No features require online connectivity
- Data lives on user's machine

### 3. Data Ownership

- Zero lock-in
- User data belongs to the user
- Export anytime in standard formats
- App removal does NOT delete data

### 4. Core Independence

- Core domain logic runs without Electron, React, or UI
- Testable in pure Node.js
- No framework dependencies in business logic

## Technical Principles

### Strict Separation

```
Core ≠ UI ≠ Infra ≠ Packaging
```

- React never decides domain logic
- SQLite queries never in renderer
- IPC channels are typed contracts

### Minimal Dependencies

- Every library needs written justification
- No "just in case" abstractions
- Prefer standard APIs over libraries

### Forward-Only Migrations

- Schema changes are inevitable
- Plan for them from day 1
- Never rollback schema
- Automatic backup before migration

## What Readied is NOT

| Not This           | Because                      |
| ------------------ | ---------------------------- |
| Notion clone       | No blocks-first architecture |
| Collaboration tool | Single-user product          |
| Mobile app         | Desktop first                |
| AI-powered         | Not core value prop          |
| Cloud-required     | Offline-first identity       |

## One-Liner

> "Your notes survive the app."
