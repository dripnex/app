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

CI on that PR is the gate. When it merges:

- **Release** runs on `main`.
- It reads commits since the last tag (`feat` → minor, `fix` → patch).
- It bumps `package.json` + `apps/desktop/package.json`, writes `CHANGELOG.md`,
  tags `vX.Y.Z`, opens a **draft** GitHub Release. If the What’s New file
  exists, that body replaces the commit dump.
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
| PAT `GH_TOKEN` as `tomymaritano`   | 403 on `dripnex/readide`. Tokens expire. Bots do not.     |
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
