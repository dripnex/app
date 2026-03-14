# Automated Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual release process with a two-stage automated pipeline using semantic-release, so that releasing is a one-button workflow_dispatch action on main.

**Architecture:** Stage 1 (release.yml) runs semantic-release to analyze commits, bump versions, generate changelog, create a git tag, and publish a draft GitHub Release. Stage 2 (build.yml) triggers on the tag push, builds Electron for mac/win/linux in parallel, uploads artifacts, then undrafts the release.

**Tech Stack:** semantic-release, conventional-changelog-conventionalcommits, GitHub Actions, electron-builder, pnpm

---

## File Structure

| File                             | Responsibility                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/bump-version.js`        | Sync version across root and desktop package.json                               |
| `scripts/bump-version.test.js`   | Tests for bump-version.js                                                       |
| `release.config.js`              | semantic-release plugin chain configuration                                     |
| `.github/workflows/release.yml`  | **Replace** current — Stage 1: semantic-release (version + tag + draft release) |
| `.github/workflows/build.yml`    | **Create** — Stage 2: parallel platform builds + undraft + sync-develop         |
| `.github/workflows/auto-tag.yml` | **Delete** — replaced by semantic-release                                       |
| `package.json` (root)            | Add semantic-release devDependencies                                            |
| `CLAUDE.md`                      | Update Git Flow section                                                         |

---

## Chunk 1: Core Infrastructure

### Task 1: Install semantic-release dependencies

**Files:**

- Modify: `package.json` (root)
- Modify: `pnpm-lock.yaml` (auto-generated)

- [ ] **Step 1: Add semantic-release packages**

Run from repo root:

```bash
pnpm add -Dw semantic-release @semantic-release/commit-analyzer @semantic-release/release-notes-generator @semantic-release/changelog @semantic-release/exec @semantic-release/git @semantic-release/github conventional-changelog-conventionalcommits
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls semantic-release --depth 0
```

Expected: `semantic-release` listed in devDependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add semantic-release dependencies"
```

---

### Task 2: Create `scripts/bump-version.js`

**Files:**

- Create: `scripts/bump-version.js`
- Create: `scripts/bump-version.test.js`

- [ ] **Step 1: Write the failing test**

Create `scripts/bump-version.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { execFileSync } from 'child_process';

const FIXTURES = resolve(import.meta.dirname, '__fixtures__');

describe('bump-version.js', () => {
  beforeEach(() => {
    mkdirSync(join(FIXTURES, 'apps/desktop'), { recursive: true });
    writeFileSync(
      join(FIXTURES, 'package.json'),
      JSON.stringify({ name: 'root', version: '0.9.0' }, null, 2) + '\n'
    );
    writeFileSync(
      join(FIXTURES, 'apps/desktop/package.json'),
      JSON.stringify({ name: 'desktop', version: '0.9.0' }, null, 2) + '\n'
    );
  });

  afterEach(() => {
    rmSync(FIXTURES, { recursive: true, force: true });
  });

  it('updates version in both package.json files', () => {
    execFileSync('node', [resolve(import.meta.dirname, 'bump-version.js'), '1.0.0'], {
      cwd: FIXTURES,
    });

    const root = JSON.parse(readFileSync(join(FIXTURES, 'package.json'), 'utf8'));
    const desktop = JSON.parse(readFileSync(join(FIXTURES, 'apps/desktop/package.json'), 'utf8'));

    expect(root.version).toBe('1.0.0');
    expect(desktop.version).toBe('1.0.0');
  });

  it('exits with error when no version provided', () => {
    expect(() =>
      execFileSync('node', [resolve(import.meta.dirname, 'bump-version.js')], {
        cwd: FIXTURES,
        stdio: 'pipe',
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run scripts/bump-version.test.js
```

Expected: FAIL — `bump-version.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `scripts/bump-version.js`:

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

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run scripts/bump-version.test.js
```

Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/bump-version.js scripts/bump-version.test.js
git commit -m "feat(release): add bump-version.js for monorepo version sync"
```

---

### Task 3: Create `release.config.js`

**Files:**

- Create: `release.config.js`

- [ ] **Step 1: Write the config file**

Create `release.config.js`:

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

- [ ] **Step 2: Verify config syntax**

```bash
node -e "import('./release.config.js').then(c => console.log('OK:', c.default.branches))"
```

Expected: `OK: [ 'main', { name: 'beta', prerelease: true } ]`

- [ ] **Step 3: Commit**

```bash
git add release.config.js
git commit -m "feat(release): add semantic-release configuration"
```

---

## Chunk 2: GitHub Actions Workflows

### Task 4: Replace `.github/workflows/release.yml`

**Files:**

- Replace: `.github/workflows/release.yml`

The current file (200 lines) has: tag-triggered validate + build + release + tweet jobs. The new file replaces ALL of that with a single semantic-release job triggered by `workflow_dispatch`.

- [ ] **Step 1: Replace the current release workflow**

Delete the current contents of `.github/workflows/release.yml` and write the new Stage 1 workflow:

```yaml
name: Release

on:
  workflow_dispatch:

concurrency:
  group: release
  cancel-in-progress: false

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

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); print('Valid YAML')"
```

Expected: `Valid YAML`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat(release): replace release workflow with semantic-release stage 1"
```

---

### Task 5: Create `.github/workflows/build.yml`

**Files:**

- Create: `.github/workflows/build.yml`

This is the largest file in the plan. It contains 4 jobs: `build` (matrix: mac/win/linux), `publish` (undraft release), `tweet` (non-blocking), and `sync-develop` (auto-PR main→develop).

- [ ] **Step 1: Write the build workflow**

Create `.github/workflows/build.yml`:

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

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: pnpm-${{ matrix.platform }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: pnpm-${{ matrix.platform }}-

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
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG_NAME: ${{ github.ref_name }}
        run: gh release edit "$TAG_NAME" --draft=false --repo "${{ github.repository }}"

  tweet:
    needs: publish
    runs-on: ubuntu-latest
    if: "!contains(github.ref_name, 'beta')"
    continue-on-error: true
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

  sync-develop:
    needs: publish
    runs-on: ubuntu-latest
    steps:
      - name: Create sync PR
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr create \
            --base develop \
            --head main \
            --title "chore: sync release ${{ github.ref_name }} back to develop" \
            --body "Auto sync of release commit and changelog." \
            --repo "${{ github.repository }}"
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml')); print('Valid YAML')"
```

Expected: `Valid YAML`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "feat(release): add build workflow for tag-triggered platform builds"
```

---

### Task 6: Delete `.github/workflows/auto-tag.yml`

**Files:**

- Delete: `.github/workflows/auto-tag.yml`

- [ ] **Step 1: Delete the file**

```bash
git rm .github/workflows/auto-tag.yml
```

- [ ] **Step 2: Verify deletion**

```bash
ls .github/workflows/auto-tag.yml 2>&1
```

Expected: `No such file or directory`

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove auto-tag workflow (replaced by semantic-release)"
```

---

## Chunk 3: Documentation

### Task 7: Update CLAUDE.md Git Flow section

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Git Flow section**

Replace the existing Git Flow section in CLAUDE.md. The section starts at `## Git Flow` and ends before `## Commit Messages` (keep Commit Messages and PR Requirements unchanged).

New content for the Git Flow section:

```markdown
## Git Flow

We use a simplified Git Flow with automated releases:
```

main ← Production releases (semantic-release runs here)
└── develop ← Integration branch
└── feature/_ ← Feature development
└── fix/_ ← Bug fixes

````

### Branches

| Branch      | Purpose                   | Merges to            |
| ----------- | ------------------------- | -------------------- |
| `main`      | Production releases       | -                    |
| `develop`   | Integration, next release | `main` (via PR)      |
| `feature/*` | New features              | `develop`            |
| `fix/*`     | Bug fixes                 | `develop`            |

### Release Process (Automated)

1. PR from `develop` to `main` — CI validates
2. Click **"Run workflow"** on the **Release** action (`workflow_dispatch`)
3. semantic-release analyzes commits, bumps version, creates tag + draft GitHub Release
4. Tag push triggers Build workflow — builds mac/win/linux in parallel
5. All builds succeed → Release is undrafted → electron-updater picks it up
6. Auto-PR syncs main back to develop

**Manual steps: 2** (merge PR + click Release)

### Rollback

```bash
# Soft rollback — stop distribution immediately
gh release edit v0.10.0 --draft

# Hard rollback — delete entirely
gh release delete v0.10.0 --yes
git push --delete origin v0.10.0
````

### Workflow

**Starting new work:**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

**Creating PR:**

```bash
git push -u origin feature/my-feature
gh pr create --base develop --head feature/my-feature
```

**After PR merged:**

```bash
git checkout develop
git pull origin develop
git branch -d feature/my-feature
```

````

Remove the old `release/*` row from the Branches table and the `release/*` branch from the Git Flow diagram. Keep the Commit Messages section and PR Requirements section that follow unchanged.

- [ ] **Step 2: Verify the edit**

Read the CLAUDE.md Git Flow section and confirm:
- No mention of `release/*` branches
- Release Process (Automated) subsection present
- Rollback subsection present
- Commit Messages and PR Requirements unchanged

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update Git Flow section for automated release pipeline"
````

---

## Verification

After all tasks are complete:

- [ ] **Run full test suite:** `pnpm test`
- [ ] **Run typecheck:** `pnpm typecheck`
- [ ] **Verify all workflow files parse:** `python3 -c "import yaml, glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]; print('All workflows valid')"`
- [ ] **Verify release.config.js loads:** `node -e "import('./release.config.js').then(() => console.log('OK'))"`
- [ ] **Verify bump-version.js tests pass:** `pnpm vitest run scripts/bump-version.test.js`

## Required GitHub Secrets

Before the first release, ensure these secrets are configured in the repository:

| Secret                        | Purpose                                                     | Already configured?   |
| ----------------------------- | ----------------------------------------------------------- | --------------------- |
| `GH_TOKEN`                    | PAT for semantic-release tag push + electron-builder upload | **New — must create** |
| `CSC_LINK`                    | macOS code signing certificate                              | Yes (existing)        |
| `CSC_KEY_PASSWORD`            | macOS certificate password                                  | Yes (existing)        |
| `APPLE_ID`                    | Apple notarization                                          | Yes (existing)        |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple notarization                                          | Yes (existing)        |
| `APPLE_TEAM_ID`               | Apple notarization                                          | Yes (existing)        |
| `TWITTER_API_KEY`             | Tweet job                                                   | Yes (existing)        |
| `TWITTER_API_SECRET`          | Tweet job                                                   | Yes (existing)        |
| `TWITTER_ACCESS_TOKEN`        | Tweet job                                                   | Yes (existing)        |
| `TWITTER_ACCESS_SECRET`       | Tweet job                                                   | Yes (existing)        |

The only **new** secret needed is `GH_TOKEN` — a Personal Access Token with `contents: write` scope. The default `GITHUB_TOKEN` cannot push tags that trigger other workflows.
