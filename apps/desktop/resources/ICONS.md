# App Icons

Source mark: `logo.png` (tight brand PNG for in-app chrome).

## How macOS wants it

Apple HIG (`app-icons`): 1024×1024 **square**, no pre-rounded corners.
The system applies the Dock squircle to the packaged `.icns`.
Keep the glyph inside the production-template grid — primary art
centered, not touching the mask. A simple mark (Docker whale, our
chevron) reads at ~50% of the tile (512 px on the 1024 canvas, ~25%
margin). Filling the tile makes the icon look oversized next to
Slack / Docker / Cursor.

`app.dock.setIcon` does **not** apply the system mask. Dev must use
`icon-dock.png` (pre-squirreled). Packaged builds use `icon.icns`.

```
# 512 px mark, pad to 1024, then:
swift scripts/make-dock-icon.swift apps/desktop/resources/icon.png \
  apps/desktop/resources/icon-dock.png
```

Place the following icon files in this directory before building for release:

## Required Files

- `icon.icns` - macOS app icon (512x512 @2x recommended)
- `icon.ico` - Windows app icon (256x256 recommended)
- `icons/` - Linux icons directory with:
  - `16x16.png`
  - `32x32.png`
  - `48x48.png`
  - `64x64.png`
  - `128x128.png`
  - `256x256.png`
  - `512x512.png`

## Generating Icons

You can use tools like:

- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html) (macOS)
- Online converters for .ico files

## From a PNG source

```bash
# Install electron-icon-builder
npm install -g electron-icon-builder

# Generate all icons from a 1024x1024 PNG
electron-icon-builder --input=icon.png --output=./
```
