# How Dripnex ships

One path. Two human steps. Everything else is Actions.

```
feature PR  ──squash──►  develop
develop     ──merge commit──►  main
main push   ──Release──►  tag + draft GitHub Release
            ──Build & Publish──►  mac / win / linux
            ──undraft──►  users get the update
            ──PR──►  develop (changelog + version bump)
```

You never bump `package.json`, never push a tag, never click **Run workflow**.

## Every day

1. Branch off `develop`. Non-draft PRs into `develop` **squash auto-merge** when CI is green ([`docs/ci.md`](./ci.md)).
2. Title is the commit (`feat(desktop): …`, `fix(ai): …`). That title is what
   semantic-release reads.

## Cut a version

1. Write `docs/releases/vX.Y.Z.md` (see `docs/WHATS_NEW.md`) and land it on
   `develop` first. Status stays `draft`.
2. Open a PR **`develop` → `main`** titled `chore(release): promote X.Y.Z`.
3. **Merge commit. Never squash.** Squash collapses every `feat` into one
   `chore` and semantic-release will not bump.

If that PR sits at **BEHIND**, `main` has commits `develop` never received and
`main` requires branches to be up to date. Back-merge first:

```bash
git checkout -b chore/backmerge-main origin/develop
git merge origin/main -m "chore(release): merge main into develop"
git push -u origin chore/backmerge-main
```

Open it against `develop` and **merge it with a merge commit**. A squash
replays `main`'s changes as a new commit, so `main` never becomes an ancestor
and the promotion stays BEHIND. Branches named `chore/backmerge-*` are excluded
from the squash auto-merge for exactly this reason.

CI on that PR is the gate. When it merges:

- **Release** runs on `main`.
- It reads commits since the last tag (`feat` → minor, `fix` → patch).
- It tags `vX.Y.Z` on the merge SHA and opens a **draft** GitHub Release.
  It does **not** push a version-bump commit to `main` (branch rules require
  a PR). Build stamps `package.json` from the tag right before packaging.
  If `docs/releases/vX.Y.Z.md` exists, that body is the GitHub notes.
- **Build & Publish** starts from that success (not from the tag push — GitHub
  will not let `GITHUB_TOKEN` trigger another workflow via tags).
- All three platforms green → the release is published → electron-updater sees
  it. Flip What’s New to `status: published`.
- A PR `main` → `develop` opens with the bump commit.

If Release logs `No release to cut from this push`, the merge had no `feat` /
`fix` / `perf` since the last tag. Do not hand-tag.

## Retry a build

```bash
gh workflow run "Build & Publish" -f tag=v0.16.0
```

## Why the old process failed

| What we did                        | What actually happened                                    |
| ---------------------------------- | --------------------------------------------------------- |
| PAT `GH_TOKEN` as `tomymaritano`   | 403. Tokens expire. Bots do not.                          |
| **Run workflow** by hand           | Easy to forget. 0.16.0 sat on `main` with no tag.         |
| Squash the promotion PR            | All `feat` commits vanish. No minor bump.                 |
| Title `feat(release): cut v0.15.x` | One fake Feature. The real changelog is a single line.    |
| Tag push to start Build            | `GITHUB_TOKEN` cannot start a sibling workflow. Dead PAT. |

This pipeline uses `GITHUB_TOKEN` only. No personal PAT.

`Build & Publish` listens via `workflow_run`. That file has to exist on
**develop** (the default branch) or GitHub never starts it. Land the same
workflows on both `develop` and `main`.

## Signing

macOS notarization and Windows Authenticode still need secrets (`CSC_*`,
`APPLE_*`). Those are in repo Actions secrets. See
[`apps/desktop/RELEASES.md`](../apps/desktop/RELEASES.md) for the local
packaged checklist (CodeMirror `tags is not iterable`, update-install).
