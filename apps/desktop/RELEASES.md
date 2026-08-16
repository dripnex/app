# Release Process

## Auto-Updater Configuration

The app uses `electron-updater` to automatically check for and install updates from GitHub Releases.

### Configuration

- **Repository**: `dripnex/readide`
- **Update Channel**: GitHub Releases
- **Auto-download**: No (asks user first)
- **Auto-install**: Yes (on app quit)

---

## Release Workflow (automated)

Do **not** bump versions or push tags by hand. `semantic-release` owns that.

1. Open a promotion PR **`develop` → `main`**. Title must be conventional (`fix(release): cut v0.15.4 …`). Merge with a **merge commit**, never squash — squashing collapses every `fix:`/`feat:` and the changelog dies.
2. On `main`, **Actions → Release → Run workflow**.
3. semantic-release analyzes commits, bumps `package.json` + `apps/desktop/package.json`, pushes tag `vX.Y.Z`, opens a **draft** GitHub Release.
4. The tag push must trigger **Build & Publish** (mac / win / linux). That only happens if `GH_TOKEN` is a **fine-grained PAT** (`contents: write` + `pull-requests: write`). `GITHUB_TOKEN` cannot start other workflows.
5. All three builds green → the `publish` job undrafts the release → electron-updater sees it.
6. `sync-develop` opens `main` → `develop` for the release commit + changelog.

### Rotate `GH_TOKEN` (required after expiry)

v0.15.3 shipped with a dead PAT: the tag push used `GITHUB_TOKEN` so Build never started, and `sync-develop` failed silently.

1. GitHub → Settings → Developer settings → Fine-grained PAT.
2. Resource owner: `dripnex`. Repo: `readide`. Permissions: **Contents: Read and write**, **Pull requests: Read and write**, **Actions: Read and write** (needed for `gh workflow run`).
3. Repo **Settings → Secrets and variables → Actions** → update secret `GH_TOKEN`.
4. Next release: confirm the tag push starts Build & Publish on its own. Until that is verified, the fallback is `gh workflow run "Build & Publish" --ref vX.Y.Z`.

### Packaged verification (v0.15.4)

The update-install crash and the CodeMirror `tags is not iterable` bug only reproduce in the **packaged** `.app`. `pnpm e2e` runs `out/`, not the asar.

```bash
pnpm --filter @dripnex/desktop build
# Apple Silicon host. --arm64 matches the launch path below.
pnpm --filter @dripnex/desktop exec electron-builder --dir --mac --arm64 -c.mac.notarize=false
# then:
./apps/desktop/release/mac-arm64/Dripnex.app/Contents/MacOS/Dripnex --enable-logging
```

Complete this checklist **in the promotion PR body before merging** (edit the PR, do not comment after it closes):

- [ ] Note with headings / fenced code / GFM table → log has **zero** `tags is not iterable` or `[CodeMirror] plugin error`
- [ ] Long AI stream + **Install Now** ×3–5 → WARN `dropped IPC send`, no uncaught exception, app relaunches
- [ ] API key still works after that restart; `localStorage` key `dripnex-settings` has empty `ai.apiKey`
- [ ] Network blackholed → Sign In is clickable immediately; session-check error ≤ 15s
- [ ] `open "dripnex://auth/verify?token=x"` right after closing the main window → no crash

---

## Update Channels

### Production (main branch)

- Users get updates from releases tagged from `main`
- **Stable** releases only

### Beta (develop branch)

To enable beta channel:

```typescript
// apps/desktop/src/main/index.ts
autoUpdater.channel = 'beta';
```

Tag beta releases as: `v0.1.7-beta.1`

---

## Environment Variables

### Development

```bash
# Use local API
DRIPNEX_API_URL=http://localhost:8787 pnpm dev
```

### Staging

```bash
# Use staging API
DRIPNEX_API_URL=https://dripnex-api-staging.dripnex.workers.dev pnpm dev
```

### Production (default)

```bash
# Uses https://api.dripnex.app (hardcoded in build)
pnpm dist:mac
```

---

## Workflows

- **Release** (`.github/workflows/release.yml`) — `workflow_dispatch` on `main` only. semantic-release + version bump.
- **Build & Publish** (`.github/workflows/build.yml`) — on `v*` tags (must be triggered by the PAT) or `workflow_dispatch`.

---

## macOS Code Signing & Notarization

For production releases, you need:

1. **Apple Developer Account**
2. **Developer ID Application Certificate**
3. **App-specific password** for notarization

```bash
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# Build with signing
pnpm dist:mac
```

`electron-builder` will automatically sign and notarize if credentials are set.

---

## Windows Code Signing

For production releases:

1. **Code Signing Certificate** (.pfx or .p12 file)
2. Set environment variables:

```bash
export CSC_LINK="path/to/certificate.pfx"
export CSC_KEY_PASSWORD="certificate-password"

# Build with signing
pnpm dist:win
```

---

## Troubleshooting

### Update not detected

- Check GitHub release is published (not draft)
- Verify release tag matches semver format (`vX.Y.Z`)
- Check app console for autoUpdater logs

### Update download fails

- Verify internet connection
- Check GitHub API rate limits
- Ensure release assets are attached correctly

### App won't open after update

- Check signing certificates are valid
- Verify notarization succeeded (macOS)
- Check app logs in:
  - macOS: `~/Library/Logs/Dripnex/`
  - Windows: `%USERPROFILE%\AppData\Roaming\Dripnex\logs\`
  - Linux: `~/.config/Dripnex/logs/`
