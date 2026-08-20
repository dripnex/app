import { describe, expect, it } from 'vitest';
import { parseDripnexUrl } from '../parseDripnexUrl';

describe('parseDripnexUrl (renderer)', () => {
  it('matches the main-process contract', () => {
    expect(parseDripnexUrl('dripnex://note/n1')).toEqual({ kind: 'note', noteId: 'n1' });
    expect(parseDripnexUrl('dripnex://auth/verify?token=t')).toEqual({
      kind: 'auth-verify',
      token: 't',
    });
  });
});
