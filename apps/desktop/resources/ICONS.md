# App Icons

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
