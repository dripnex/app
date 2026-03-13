# Release Process

## Overview

Releases follow Git Flow and are fully automated via GitHub Actions.

## Flow

```
develop → release/X.Y.Z branch → PR to main → merge
  ↓ auto-tag.yml triggers:
  1. Creates git tag vX.Y.Z from package.json version
  2. Merges main → develop (keeps branches aligned)
  ↓ release.yml triggers (on tag push):
  3. Builds distributables (macOS, Windows, Linux)
  4. Creates draft GitHub Release with artifacts
  5. Posts tweet announcement
```

## Creating a Release

```bash
# 1. Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/0.9.0

# 2. Bump version in root package.json + apps/desktop/package.json
# 3. Update CHANGELOG.md
# 4. Commit and push
git add -A
git commit -m "chore(release): bump version to 0.9.0"
git push -u origin release/0.9.0

# 5. Create PR targeting main
gh pr create --base main --title "chore(release): v0.9.0" --body "Release 0.9.0"

# 6. Once CI passes and PR merges → tag + release + sync happen automatically
```

The release workflow will:

1. Validate tag matches `package.json` version
2. Build packages for all platforms (macOS, Windows, Linux)
3. Sign and notarize the macOS build (if secrets are configured)
4. Create a draft GitHub Release with all artifacts
5. Post tweet announcement

## Versioning

- **Format:** SemVer with `v` prefix — `v0.9.0`, `v0.9.1`, `v1.0.0`
- **Tags are created ONLY by GitHub Actions** (auto-tag.yml)
- **No manual tags** — the automation reads version from `package.json`

## Tag Protection Rules (GitHub Settings)

Configure in **Repository Settings > Rules > Tag protection rules**:

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| Tag name pattern  | `v*`                              |
| Restrict creation | Enabled                           |
| Allowed to create | GitHub Actions, Repository admins |
| Force push        | Disabled                          |

This prevents:

- Manual tags outside the release flow
- Force-pushing tags (rewriting release history)
- Tags that don't follow SemVer

## Required Secrets

### macOS Code Signing and Notarization

| Secret                        | Description                          |
| ----------------------------- | ------------------------------------ |
| `CSC_LINK`                    | Base64-encoded .p12 certificate file |
| `CSC_KEY_PASSWORD`            | Password for the .p12 certificate    |
| `APPLE_ID`                    | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for Apple ID   |
| `APPLE_TEAM_ID`               | Apple Developer Team ID              |

### Setting Up macOS Secrets

#### 1. Export Developer ID Certificate

```bash
# Open Keychain Access
# Find "Developer ID Application: Your Name (TEAM_ID)"
# Right-click > Export > Save as .p12

# Convert to base64 for GitHub
base64 -i certificate.p12 | pbcopy
# Paste into GitHub secret: CSC_LINK
```

#### 2. Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in > Security > App-Specific Passwords
3. Generate a new password
4. Save as `APPLE_APP_SPECIFIC_PASSWORD` secret

#### 3. Find Your Team ID

```bash
# In Xcode or Apple Developer portal
# Format: 10 characters like "ABC123XYZ0"
```

#### 4. Add Secrets to GitHub

1. Go to repository Settings > Secrets and variables > Actions
2. Add each secret listed above

### Windows Code Signing (Optional)

Currently not configured. Windows builds will be unsigned.

To add Windows signing:

1. Obtain an EV code signing certificate
2. Add `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets
3. Update `.github/workflows/release.yml` to include signing env vars

## Verifying Notarization

After a macOS release, verify notarization:

```bash
# Check the DMG
spctl -a -vvv -t install Readied-0.1.0.dmg

# Check the app inside
spctl -a -vvv /Applications/Readied.app
```

You should see "source=Notarized Developer ID".

## Troubleshooting

### "The app is damaged and can't be opened"

The app wasn't properly signed or notarized. Check:

- CSC_LINK is valid and not expired
- App-specific password is correct
- Hardened runtime is enabled
- Entitlements are properly configured

### Notarization Failed

Check Apple's response for specific issues:

- Missing entitlements
- Unsigned binaries inside the app
- Invalid code signature

Common fix: ensure `hardenedRuntime: true` and all entitlements are in place.
