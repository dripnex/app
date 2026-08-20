# Desktop release notes (signing, updater, packaged checks)

The ship process lives in [`docs/RELEASE.md`](../../docs/RELEASE.md).
This file is the desktop-specific leftover: updater, signing, and the
packaged-app checklist that CI cannot run.

## Auto-updater

- **Repository**: `dripnex/app`
- **Channel**: GitHub Releases (stable tags `vX.Y.Z`)
- **Auto-download**: no (asks first)
- **Auto-install**: yes (on quit)

Draft releases are invisible to the updater. Build & Publish undrafts
only after mac + win + linux artefacts exist.

## Packaged verification

The update-install crash and the CodeMirror `tags is not iterable` bug
only reproduce in the **packaged** `.app`. `pnpm e2e` runs `out/`, not the asar.

```bash
pnpm --filter @dripnex/desktop build
pnpm --filter @dripnex/desktop exec electron-builder --dir --mac --arm64 -c.mac.notarize=false
./apps/desktop/release/mac-arm64/Dripnex.app/Contents/MacOS/Dripnex --enable-logging
```

Complete this in the promotion PR **before** merge:

- [ ] Note with headings / fenced code / GFM table → log has **zero** `tags is not iterable` or `[CodeMirror] plugin error`
- [ ] Long AI stream + **Install Now** ×3–5 → WARN `dropped IPC send`, no uncaught exception, app relaunches
- [ ] API key still works after that restart; `localStorage` key `dripnex-settings` has empty `ai.apiKey`
- [ ] Network blackholed → Sign In is clickable immediately; session-check error ≤ 15s
- [ ] `open "dripnex://auth/verify?token=x"` right after closing the main window → no crash

## Signing

### macOS

`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, plus `CSC_LINK` /
`CSC_KEY_PASSWORD` for the Developer ID certificate. Set in Actions secrets.
`electron-builder` notarizes when they are present.

### Windows

`CSC_LINK` + `CSC_KEY_PASSWORD` (.pfx). Unsigned builds still upload; the
updater will install them, SmartScreen will complain.

## Troubleshooting

**Update not detected.** Release is still a draft, or the tag is not `vX.Y.Z`.

**Update download fails.** GitHub rate limit, or the `publish` job undrafted
with no artefacts (Build should fail before that now).

**App won't open after update.** Signing / notarization. Logs:

- macOS: `~/Library/Logs/Dripnex/`
- Windows: `%USERPROFILE%\AppData\Roaming\Dripnex\logs\`
- Linux: `~/.config/Dripnex/logs/`
