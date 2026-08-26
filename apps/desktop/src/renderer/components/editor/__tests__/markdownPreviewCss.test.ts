import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../MarkdownPreview.module.css'),
  'utf8'
);

describe('MarkdownPreview highlight.js globals', () => {
  it('keeps compound hljs class names inside :global(...)', () => {
    expect(css).not.toMatch(/:global\(\.hljs-[^)]+\)-/);
    expect(css).toContain(':global(.hljs-selector-tag)');
    expect(css).toContain(':global(.hljs-template-tag)');
    expect(css).toContain(':global(.hljs-template-variable)');
    expect(css).toContain(':global(.hljs-selector-class)');
    expect(css).toContain(':global(.hljs-selector-id)');
  });
});
