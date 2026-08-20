import { describe, expect, it } from 'vitest';
import { wrapSelectionAsLink } from '../pasteAsLink';

describe('wrapSelectionAsLink', () => {
  it('wraps the selection with the clipboard URL', () => {
    expect(wrapSelectionAsLink('see Dripnex here', 4, 11, 'https://dripnex.app')).toEqual({
      from: 4,
      to: 11,
      text: '[Dripnex](https://dripnex.app)',
    });
  });

  it('uses a placeholder label when nothing is selected', () => {
    expect(wrapSelectionAsLink('hello', 5, 5, 'https://dripnex.app')).toEqual({
      from: 5,
      to: 5,
      text: '[link](https://dripnex.app)',
    });
  });

  it('returns null for an empty clipboard', () => {
    expect(wrapSelectionAsLink('hello', 0, 5, '   ')).toBeNull();
  });
});
