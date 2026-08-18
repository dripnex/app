# What's New — how Dripnex talks about releases

Inkdrop v6 is a **story**, not a commit dump. Ours has been the opposite:
promotion PRs titled `feat(release): cut v0.15.x` collapse every real change
into one line. `CHANGELOG.md` and dripnex.app/changelog then repeat that line.

Two artifacts. Two audiences.

| Artifact                              | Audience  | Who writes it                    |
| ------------------------------------- | --------- | -------------------------------- |
| `CHANGELOG.md` + GitHub Release body  | Engineers | semantic-release (keep)          |
| `apps/web/content/releases/vX.Y.Z.md` | Humans    | You, **before** the promotion PR |

## Rules

1. A version does not ship without a What's New file.
2. Write it like Inkdrop: sections people feel (Editor, Plugins, Sync), screenshots
   if you have them, no `closes #284`.
3. Never title a promotion PR `feat(release): cut v…`. Use
   `chore(release): promote 0.16.0` so semantic-release does **not** invent a
   fake Feature from the merge.
4. The website changelog **prefers** authored What's New. GitHub is the
   engineering log underneath.
5. Forum (when we have one) reprints the same file. Do not write a third copy.

## File

```
apps/web/content/releases/v0.16.0.md
```

```md
---
version: 0.16.0
date: 2026-08-17
title: Hackable to its core
status: draft
---

One paragraph of why this version exists.

## Section people care about

What changed, in their words.
```

`status: draft` stays off the public page. Flip to `published` when the GitHub
release is undrafted.
