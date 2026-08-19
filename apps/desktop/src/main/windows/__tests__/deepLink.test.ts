import { describe, expect, it } from 'vitest';
import { parseDripnexUrl } from '../deepLink';

describe('parseDripnexUrl', () => {
  it('parses auth verify', () => {
    expect(parseDripnexUrl('dripnex://auth/verify?token=abc')).toEqual({
      kind: 'auth-verify',
      token: 'abc',
    });
  });

  it('parses note, notebook, book alias, and tag', () => {
    expect(parseDripnexUrl('dripnex://note/n1#intro')).toEqual({
      kind: 'note',
      noteId: 'n1',
      heading: 'intro',
    });
    expect(parseDripnexUrl('dripnex://notebook/nb1')).toEqual({
      kind: 'notebook',
      notebookId: 'nb1',
    });
    expect(parseDripnexUrl('dripnex://book/nb1')).toEqual({
      kind: 'notebook',
      notebookId: 'nb1',
    });
    expect(parseDripnexUrl('dripnex://tag/ship%20it')).toEqual({
      kind: 'tag',
      tag: 'ship it',
    });
  });

  it('rejects unknown hosts and other schemes', () => {
    expect(parseDripnexUrl('dripnex://unknown/x')).toBeNull();
    expect(parseDripnexUrl('https://dripnex.app')).toBeNull();
    expect(parseDripnexUrl('dripnex://note/')).toBeNull();
  });
});
