import { describe, expect, it } from 'vitest';
import { normalizeGithubRemote } from '../gitRemote';

describe('normalizeGithubRemote', () => {
  it('accepts https GitHub URLs', () => {
    expect(normalizeGithubRemote('https://github.com/dripnex/notes')).toBe(
      'https://github.com/dripnex/notes.git'
    );
    expect(normalizeGithubRemote('https://github.com/dripnex/notes.git')).toBe(
      'https://github.com/dripnex/notes.git'
    );
  });

  it('rejects ssh and non-GitHub hosts', () => {
    expect(normalizeGithubRemote('git@github.com:dripnex/notes.git')).toBeNull();
    expect(normalizeGithubRemote('https://gitlab.com/dripnex/notes')).toBeNull();
  });
});
