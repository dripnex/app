# Release Process

## Overview

Releases are automated via GitHub Actions. When you push a tag starting with `v` (e.g., `v0.1.0`), the release workflow builds and publishes distributables for macOS, Windows, and Linux.

## Creating a Release

```bash
# 1. Update version in apps/desktop/package.json
# 2. Commit the change
git add apps/desktop/package.json
git commit -m "chore: bump version to 0.1.0"

# 3. Create and push the tag
git tag v0.1.0
git push origin main --tags
```

The workflow will:
1. Build packages for all platforms
2. Sign and notarize the macOS build (if secrets are configured)
3. Create a draft GitHub release with all artifacts

## Required Secrets

### macOS Code Signing and Notarization

| Secret | Description |
|--------|-------------|
| `CSC_LINK` | Base64-encoded .p12 certificate file |
| `CSC_KEY_PASSWORD` | Password for the .p12 certificate |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for Apple ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

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
