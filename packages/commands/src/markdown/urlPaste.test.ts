import { describe, expect, it } from 'vitest';
import {
  formatPastedUrl,
  isBareHttpUrl,
  isInsideMarkdownLink,
  sanitizeLinkTitle,
  wrapSelectionWithUrl,
} from './urlPaste';

describe('isBareHttpUrl', () => {
  it('accepts a single http(s) token', () => {
    expect(isBareHttpUrl('https://dripnex.app')).toBe(true);
    expect(isBareHttpUrl('  http://example.com/a  ')).toBe(true);
  });

  it('rejects prose and incomplete urls', () => {
    expect(isBareHttpUrl('see https://dripnex.app')).toBe(false);
    expect(isBareHttpUrl('dripnex.app')).toBe(false);
    expect(isBareHttpUrl('')).toBe(false);
  });
});

describe('isInsideMarkdownLink', () => {
  it('detects being inside the label or destination', () => {
    expect(isInsideMarkdownLink('[hello', 6)).toBe(true);
    expect(isInsideMarkdownLink('[hello](https://x', 17)).toBe(true);
  });

  it('is false after a complete link', () => {
    expect(isInsideMarkdownLink('[hello](https://x.com) ', 23)).toBe(false);
  });
});

describe('formatPastedUrl', () => {
  it('formats plain, angle, and markdown', () => {
    const url = 'https://dripnex.app';
    expect(formatPastedUrl(url, 'plain')).toBe(url);
    expect(formatPastedUrl(url, 'angle')).toBe('<https://dripnex.app>');
    expect(formatPastedUrl(url, 'markdown')).toBe('[https://dripnex.app](https://dripnex.app)');
    expect(formatPastedUrl(url, 'markdown', 'Dripnex')).toBe('[Dripnex](https://dripnex.app)');
  });
});

describe('wrapSelectionWithUrl', () => {
  it('wraps the selection', () => {
    expect(wrapSelectionWithUrl('Dripnex', 'https://dripnex.app')).toBe(
      '[Dripnex](https://dripnex.app)'
    );
  });
});

describe('sanitizeLinkTitle', () => {
  it('strips newlines and closing brackets', () => {
    expect(sanitizeLinkTitle('Foo]\nBar')).toBe('Foo Bar');
  });
});
