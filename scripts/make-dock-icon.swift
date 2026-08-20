import AppKit

/// Bake a macOS-style continuous squircle mask onto a square PNG.
/// `dock.setIcon` does not apply the system mask, so the runtime icon
/// must already have transparent corners.
let args = CommandLine.arguments
guard args.count >= 3 else {
  fputs("usage: make-dock-icon.swift <in.png> <out.png>\n", stderr)
  exit(1)
}

let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
guard let source = NSImage(contentsOf: input) else {
  fputs("could not read \(args[1])\n", stderr)
  exit(1)
}

let size = NSSize(width: 1024, height: 1024)
let image = NSImage(size: size, flipped: false) { rect in
  NSGraphicsContext.current?.imageInterpolation = .high
  // ~22.37% of 1024 — Apple's continuous-corner icon radius.
  let path = NSBezierPath(roundedRect: rect, xRadius: 229, yRadius: 229)
  path.addClip()
  source.draw(in: rect, from: .zero, operation: .copy, fraction: 1)
  return true
}

guard let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:])
else {
  fputs("could not encode png\n", stderr)
  exit(1)
}

try png.write(to: output)
