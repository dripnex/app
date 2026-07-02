# Release Process

## Auto-Updater Configuration

The app uses `electron-updater` to automatically check for and install updates from GitHub Releases.

### Configuration

- **Repository**: `dripnex/readide`
- **Update Channel**: GitHub Releases
- **Auto-download**: No (asks user first)
- **Auto-install**: Yes (on app quit)

---

## Release Workflow

### 1. Update Version

Edit `apps/desktop/package.json`:

```json
{
  "version": "0.1.7" // Increment version
}
```

### 2. Commit and Tag

```bash
git add apps/desktop/package.json
git commit -m "chore(desktop): bump version to 0.1.7"
git tag v0.1.7
git push origin develop
git push origin v0.1.7
```

### 3. Build Releases

```bash
cd apps/desktop
pnpm build
pnpm dist:mac    # Creates DMG and ZIP for macOS (x64 + arm64)
pnpm dist:win    # Creates NSIS installer for Windows
pnpm dist:linux  # Creates AppImage and DEB for Linux
```

**Output location**: `apps/desktop/release/`

### 4. Create GitHub Release

1. Go to: https://github.com/dripnex/readide/releases/new
2. **Tag**: `v0.1.7` (same as git tag)
3. **Title**: `Dripnex v0.1.7`
4. **Description**: Changelog/release notes
5. **Attach files** from `apps/desktop/release/`:
   - `Dripnex-0.1.7-arm64.dmg`
   - `Dripnex-0.1.7-x64.dmg`
   - `Dripnex-0.1.7-arm64-mac.zip`
   - `Dripnex-0.1.7-x64-mac.zip`
   - `Dripnex Setup 0.1.7.exe`
   - `Dripnex-0.1.7-x64.AppImage`
   - `dripnex_0.1.7_amd64.deb`
6. **Publish release**

### 5. Verify Auto-Update

1. Open the app (with older version)
2. After ~60 seconds, should show update notification
3. Click "Download Update"
4. Quit app → Update installs automatically
5. Restart → New version loads

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

## GitHub Actions (Optional - Future)

Create `.github/workflows/release.yml`:

```yaml
name: Release Desktop App

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: |
          cd apps/desktop
          pnpm build
          pnpm dist

      - name: Upload Release Assets
        uses: softprops/action-gh-release@v1
        with:
          files: apps/desktop/release/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

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
