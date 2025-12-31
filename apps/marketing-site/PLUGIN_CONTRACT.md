# Readied Plugin Contract

This document defines what plugins can and cannot do in Readied.

## Core Principle

**Readied can have plugins as long as the file doesn't need them.**

A plugin is valid only if uninstalling it doesn't break any `.md` file.

---

## The Five Rules

A plugin is allowed if it passes ALL of these checks:

1. **Can be removed without affecting any `.md` file**
2. **Does not introduce new syntax**
3. **Does not mutate content automatically**
4. **Is not required to interpret the text**
5. **Does not create dependencies between notes**

If it fails ONE rule, it doesn't ship.

---

## Valid Plugins (Examples)

These extend the editor without touching the format:

| Plugin              | Why it's allowed                      |
| ------------------- | ------------------------------------- |
| Word count          | Read-only, derived from content       |
| Outline view        | Visualization, not storage            |
| Backlinks panel     | Computed index, not embedded          |
| Export to PDF       | Output transformation, file unchanged |
| Lint warnings       | Visual feedback, no mutations         |
| Custom themes       | Presentation only                     |
| Keyboard shortcuts  | Commands, not auto-transforms         |
| Explicit formatters | User-triggered, not implicit          |

---

## Invalid Plugins (Examples)

These create dependencies or modify the format:

| Plugin                  | Why it's rejected          |
| ----------------------- | -------------------------- |
| Custom block syntax     | Requires plugin to render  |
| Auto-formatting on type | Implicit transformation    |
| Wikilinks `[[page]]`    | Non-standard Markdown      |
| Embedded queries        | Proprietary syntax         |
| Sync adapters           | Creates cloud dependency   |
| AI writing assistants   | Requires external servers  |
| Template expansion      | Mutates text automatically |

---

## The Database Rule

Same principle applies to internal features:

> If deleting Readied's database doesn't lose your data, the feature is allowed.

- Search index? Rebuilt from files. **Allowed.**
- Backlinks? Computed from files. **Allowed.**
- Graph view? Visualization of files. **Allowed.**
- Proprietary metadata? Not in files. **Rejected.**

---

## Explicit vs Implicit

The line between valid and invalid often comes down to this:

| Type     | Example                      | Verdict |
| -------- | ---------------------------- | ------- |
| Explicit | `Cmd+Shift+F` formats block  | Valid   |
| Implicit | Typing `# ` auto-expands     | Invalid |
| Explicit | Click button to insert link  | Valid   |
| Implicit | Auto-correct Markdown syntax | Invalid |

**User-triggered = allowed.**
**Auto-triggered = rejected.**

---

## Why This Matters

Plugin ecosystems become platforms.
Platforms optimize for extensibility.
Extensibility creates lock-in.

Readied optimizes for **survivability**.

Your notes should work:

- Without the plugin
- Without the app
- In 10 years
- In any Markdown editor

This contract ensures they will.

---

## Summary

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Plugin extends editor?          → VALID           │
│   Plugin changes file format?     → REJECTED        │
│   Plugin is user-triggered?       → VALID           │
│   Plugin runs automatically?      → REJECTED        │
│   File works without plugin?      → VALID           │
│   File needs plugin to render?    → REJECTED        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

This is the line. We don't cross it.
