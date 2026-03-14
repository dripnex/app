# Automated Release Pipeline Design

> Production-grade CI/CD for Readied desktop app with semantic versioning, two-stage builds, and electron auto-update.

## Goal

Replace the manual release process (create release branch, bump version, PR to main, wait for auto-tag) with a one-button pipeline: merge to main, click Release, everything else is automated.

## Constraints

- ~500+ users receiving auto-updates via electron-updater
- Mac (arm64 + x64) and Windows (x64) signed builds, Linux (x64)
- Apple notarization required for macOS
- Production-grade reliability — broken releases must never reach users
- Minimal manual steps (target: 2)

## Architecture

### Git Branching (Simplified)

```
main          <- production releases (semantic-release runs here)
  +-- develop <- integration branch
        +-- feature/* <- feature development
        +-- fix/*     <- bug fixes
```

**Changes from current setup:**

- **Remove `release/*` branches** — semantic-release automates version bumping and tagging
- **Remove `auto-tag.yml` workflow** — semantic-release handles tag creation
- **`main` is the release branch** — semantic-release runs on main via workflow_dispatch
- **Keep `automerge.yml`** — still useful for dependabot PRs

**Workflow:**

1. Developer creates `feature/*` or `fix/*` branch from develop
2. PR to develop — CI validates (tests, typecheck, lint)
3. When ready to release: PR from develop to main — CI validates again
4. Click "Run workflow" on Release action (one button)
5. Everything else is automated
6. After release: merge main back to develop (automated via post-release workflow or manual PR)

### Two-Stage Pipeline

```
Stage 1: Release (~30s)                    Stage 2: Build (~15-20min)
+-----------------------------+            +----------------------------------+
| workflow_dispatch on main   |            | triggered by tag push v*         |
|                             |            |                                  |
| 1. semantic-release         |---tag----> | 1. Build mac (arm64 + x64)      |
| 2. analyzes commits         |   push     | 2. Build windows (x64)          |
| 3. bumps version            |            | 3. Build linux (x64)            |
| 4. generates changelog      |            | 4. Sign + notarize              |
| 5. creates git tag          |            | 5. Upload artifacts to Release  |
| 6. creates draft GH Release |            | 6. Undraft Release              |
+-----------------------------+            +----------------------------------+
```

**Why two stages:**

- **Isolation** — if Mac notarization times out, re-run build.yml without re-running semantic-release
- **Speed** — release step is ~30s, build step runs in parallel across 3 platforms
- **Safety** — GitHub Release stays draft until ALL platform builds succeed. Users never see a half-built release.

### Automated Versioning

**Tool:** semantic-release with conventional commits preset.

**Version calculation from commit types:**

| Commit prefix                     | Version bump | Example          |
| --------------------------------- | ------------ | ---------------- |
| `feat:`                           | minor        | 0.9.0 -> 0.10.0  |
| `fix:`                            | patch        | 0.10.0 -> 0.10.1 |
| `perf:`                           | patch        | 0.10.1 -> 0.10.2 |
| `feat!:` or `BREAKING CHANGE:`    | major        | 0.10.2 -> 1.0.0  |
| `chore:`, `docs:`, `test:`, `ci:` | no release   | skipped          |

**Monorepo version sync:** A `scripts/bump-version.js` script updates version in both root `package.json` and `apps/desktop/package.json` (electron-builder reads the desktop one).

### Changelog Generation

`@semantic-release/changelog` auto-generates `CHANGELOG.md` with categorized sections:

- **Features** — from `feat:` commits
- **Bug Fixes** — from `fix:` commits
- **Performance** — from `perf:` commits

`refactor:`, `docs:`, `chore:`, `test:`, `ci:` commits are hidden from the changelog and do not trigger releases. Only `feat:`, `fix:`, `perf:`, and breaking changes trigger version bumps.

### Release Channels

| Channel | Branch | Tag format      | electron-updater |
| ------- | ------ | --------------- | ---------------- |
| stable  | `main` | `v1.0.0`        | default channel  |
| beta    | `beta` | `v1.1.0-beta.1` | `beta` channel   |

Beta channel is configured in semantic-release but not active until a `beta` branch is created. electron-updater supports channels natively — beta users opt in via a setting.

### Electron Auto-Update Integration

**Current setup (already working):**

- `autoUpdater.autoDownload = false` — app checks but doesn't download without user consent
- `autoUpdater.autoInstallOnAppQuit = true` — installs silently on next quit
- Check fires 3 seconds after app launch
- IPC handlers: `updates:checkForUpdates`, `updates:startDownload`, `updates:installAndRestart`
- Update provider: GitHub Releases (`provider: github` in electron-builder config)

**No changes needed** to the auto-update code. The draft/publish pattern ensures users only see completed releases.

**UX flow for users:**

1. App starts, checks GitHub Releases after 3s
2. If update available: notification shown to user
3. User clicks "Download" — downloads in background with progress
4. User clicks "Install & Restart" or update installs on next quit

## Files

### New Files

| File                            | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `release.config.js`             | semantic-release configuration                  |
| `.github/workflows/release.yml` | Stage 1: version + tag + draft release          |
| `.github/workflows/build.yml`   | Stage 2: platform builds + publish              |
| `scripts/bump-version.js`       | Sync version across monorepo package.json files |

### Files to Delete

| File                                      | Reason                                  |
| ----------------------------------------- | --------------------------------------- |
| `.github/workflows/release.yml` (current) | Replaced by new release.yml + build.yml |
| `.github/workflows/auto-tag.yml`          | semantic-release handles tagging        |

### Files to Keep (Unchanged)

| File                               | Reason                       |
| ---------------------------------- | ---------------------------- |
| `.github/workflows/ci.yml`         | Still validates PRs          |
| `.github/workflows/automerge.yml`  | Still auto-merges dependabot |
| `.github/workflows/codeql.yml`     | Security scanning            |
| `.github/workflows/deploy-api.yml` | API deployment               |
| `.github/workflows/docs.yml`       | Docs deployment              |
| `.github/workflows/pr-size.yml`    | PR size labels               |

### Files to Modify

| File           | Change                                          |
| -------------- | ----------------------------------------------- |
| `package.json` | Add semantic-release devDependencies            |
| `CLAUDE.md`    | Update Git Flow section to reflect new pipeline |

## Implementation Details

### release.config.js

```js
export default {
  branches: ['main', { name: 'beta', prerelease: true }],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { breaking: true, release: 'major' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance' },
            { type: 'refactor', section: 'Refactoring', hidden: true },
            { type: 'docs', section: 'Documentation', hidden: true },
            { type: 'chore', hidden: true },
            { type: 'test', hidden: true },
            { type: 'ci', hidden: true },
          ],
        },
      },
    ],
    '@semantic-release/changelog',
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/bump-version.js ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'apps/desktop/package.json'],
        message: 'chore(release): v${nextRelease.version} [skip ci]',
      },
    ],
    [
      '@semantic-release/github',
      {
        draftRelease: true,
      },
    ],
  ],
};
```

### .github/workflows/release.yml

```yaml
name: Release

on:
  workflow_dispatch:

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GH_TOKEN }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
          GIT_AUTHOR_NAME: github-actions[bot]
          GIT_AUTHOR_EMAIL: github-actions[bot]@users.noreply.github.com
          GIT_COMMITTER_NAME: github-actions[bot]
          GIT_COMMITTER_EMAIL: github-actions[bot]@users.noreply.github.com
        run: npx semantic-release
```

### .github/workflows/build.yml

```yaml
name: Build & Publish

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

env:
  NODE_VERSION: '22'
  ELECTRON_CACHE: ~/.cache/electron
  ELECTRON_BUILDER_CACHE: ~/.cache/electron-builder

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-14
            platform: mac
          - os: windows-latest
            platform: win
          - os: ubuntu-latest
            platform: linux

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout tag
        uses: actions/checkout@v4
        with:
          ref: ${{ github.ref }}
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Cache Electron downloads
        uses: actions/cache@v4
        with:
          path: |
            ${{ env.ELECTRON_CACHE }}
            ${{ env.ELECTRON_BUILDER_CACHE }}
          key: electron-${{ matrix.platform }}-${{ hashFiles('apps/desktop/package.json') }}
          restore-keys: electron-${{ matrix.platform }}-

      - name: Force HTTPS for GitHub git dependencies
        shell: bash
        run: git config --global 'url.https://github.com/.insteadOf' 'git@github.com:'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Build Electron app
        working-directory: apps/desktop
        run: pnpm build

      - name: Build distributables (macOS)
        if: matrix.platform == 'mac'
        working-directory: apps/desktop
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: pnpm dist:mac --publish always

      - name: Build distributables (Windows)
        if: matrix.platform == 'win'
        working-directory: apps/desktop
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: pnpm dist:win --publish always

      - name: Build distributables (Linux)
        if: matrix.platform == 'linux'
        working-directory: apps/desktop
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: pnpm dist:linux --publish always

      - name: Upload artifacts (backup)
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}-build
          path: |
            apps/desktop/release/*.dmg
            apps/desktop/release/*.zip
            apps/desktop/release/*.exe
            apps/desktop/release/*.AppImage
            apps/desktop/release/*.deb
            apps/desktop/release/latest*.yml
            apps/desktop/release/*.blockmap
          if-no-files-found: ignore
          retention-days: 30

  publish:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Publish GitHub Release
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          TAG_NAME: ${{ github.ref_name }}
        run: gh release edit "$TAG_NAME" --draft=false --repo "${{ github.repository }}"

  tweet:
    needs: publish
    runs-on: ubuntu-latest
    if: "!contains(github.ref_name, 'beta')"
    steps:
      - name: Extract version
        id: version
        run: echo "tag=${GITHUB_REF#refs/tags/}" >> "$GITHUB_OUTPUT"

      - name: Post tweet
        uses: dart-actions/tweet@v1
        with:
          consumer-key: ${{ secrets.TWITTER_API_KEY }}
          consumer-secret: ${{ secrets.TWITTER_API_SECRET }}
          access-token: ${{ secrets.TWITTER_ACCESS_TOKEN }}
          access-token-secret: ${{ secrets.TWITTER_ACCESS_SECRET }}
          text: |
            Readied ${{ steps.version.outputs.tag }} is out!

            https://github.com/${{ github.repository }}/releases/tag/${{ steps.version.outputs.tag }}
            #readied #markdown #devtools
```

### scripts/bump-version.js

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const version = process.argv[2];
if (!version) {
  console.error('Usage: bump-version.js <version>');
  process.exit(1);
}

const files = ['package.json', 'apps/desktop/package.json'];

for (const file of files) {
  const path = resolve(file);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${file} -> ${version}`);
}
```

## Post-Release: Sync Main Back to Develop

After semantic-release commits the version bump and CHANGELOG to main, develop will diverge. Add a job at the end of build.yml to auto-create a PR:

```yaml
sync-develop:
  needs: publish
  runs-on: ubuntu-latest
  steps:
    - name: Checkout main
      uses: actions/checkout@v4
      with:
        ref: main
        fetch-depth: 0
        token: ${{ secrets.GH_TOKEN }}

    - name: Create sync PR
      env:
        GH_TOKEN: ${{ secrets.GH_TOKEN }}
      run: |
        git checkout -b chore/sync-release-${{ github.ref_name }}
        git push -u origin chore/sync-release-${{ github.ref_name }}
        gh pr create \
          --base develop \
          --head chore/sync-release-${{ github.ref_name }} \
          --title "chore: sync ${{ github.ref_name }} release to develop" \
          --body "Auto-generated PR to sync version bump and CHANGELOG from main back to develop."
```

This PR is auto-mergeable via the existing automerge.yml workflow.

## Edge Cases

### No Releasable Commits

If all commits since the last tag are `chore:`, `docs:`, `test:`, `ci:`, or `refactor:`, semantic-release exits successfully (exit code 0) but creates no release. The workflow shows as "success" with no tag pushed. This is expected behavior — no action needed.

### electron-builder `--publish always` with Draft Releases

electron-builder's `--publish always` detects an existing GitHub Release for the current tag and uploads artifacts to it. Since semantic-release creates the release as draft (via `draftRelease: true`), electron-builder uploads to that draft. This is the documented and tested behavior. The publish job then undrafts it after all platforms complete.

## Future Improvements

- **Windows code signing** — Currently unsigned. Add `CSC_LINK` / `CSC_KEY_PASSWORD` secrets for Windows to eliminate SmartScreen warnings.
- **macOS runner migration** — Using `macos-14` (arm64). Monitor GitHub's runner deprecation schedule and update as needed.

## Reliability Practices

### Preventing Broken Releases

1. **CI gate on main** — PR from develop must pass all checks before merge
2. **Draft releases** — GitHub Release stays draft until all 3 platform builds succeed
3. **`[skip ci]` on version commits** — prevents infinite CI loops
4. **`--frozen-lockfile`** — reproducible dependency installation
5. **`fail-fast: false`** — one platform failure doesn't cancel others
6. **Pinned macOS runner** — `macos-14` (arm64) for stable notarization tooling
7. **Electron download cache** — faster builds, less flaky network dependency

### Rollback Strategy

**Soft rollback (stop distribution):**

```bash
# Re-draft the release — auto-update stops seeing it immediately
gh release edit v0.10.0 --draft
# Fix the issue, merge to main, click Release again
# semantic-release creates v0.10.1
```

**Hard rollback (emergency):**

```bash
# Delete release and tag entirely
gh release delete v0.10.0 --yes
git push --delete origin v0.10.0
```

**User impact:**

- Users who haven't updated stay on previous version (safe)
- Users who updated to broken version: fix ships as next patch release
- Draft/delete prevents new users from downloading broken version

### Build Reproducibility

- Tag checkout with `fetch-depth: 0` ensures full git history
- `pnpm install --frozen-lockfile` ensures exact dependency versions
- Node 22 pinned across all workflows
- pnpm version pinned via `packageManager` field in root package.json
- Electron version pinned in `apps/desktop/package.json`

## Dependencies to Install

```bash
pnpm add -Dw semantic-release \
  @semantic-release/commit-analyzer \
  @semantic-release/release-notes-generator \
  @semantic-release/changelog \
  @semantic-release/exec \
  @semantic-release/git \
  @semantic-release/github \
  conventional-changelog-conventionalcommits
```

## CLAUDE.md Updates

Update the Git Flow section to reflect:

- Remove `release/*` branch documentation
- Document the two-step release process (merge to main + click Release)
- Add rollback procedures
- Document `workflow_dispatch` trigger

## Complete Release Flow

```
1. Developer merges feature PR to develop        (CI validates)
2. When ready: PR from develop to main            (CI validates again)
3. Click "Run workflow" on Release action          (one button)
4. semantic-release:
   - Analyzes commits since last tag
   - Calculates version (e.g. 0.9.0 -> 0.10.0)
   - Updates CHANGELOG.md
   - Bumps package.json versions
   - Creates git tag v0.10.0
   - Creates draft GitHub Release
5. Tag push triggers Build workflow:
   - Builds mac/win/linux in parallel (~15-20min)
   - Signs + notarizes macOS build
   - Uploads artifacts to draft Release
   - Undrafts release when all builds succeed
6. electron-updater in the app:
   - Checks GitHub Releases on startup (3s delay)
   - Shows "Update available" notification
   - Downloads on user consent
   - Installs on quit
7. Tweet posted automatically (stable releases only)
```

**Total manual steps: 2** (merge PR to main + click Release button)
