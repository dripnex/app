import { describe, expect, it } from 'vitest';
import { GITHUB_CONNECT_REQUIRED } from '../../../../shared/githubBlob';
import { markdownFromGithubPasteResult, shouldHandleGithubPaste } from '../githubPaste';

describe('shouldHandleGithubPaste', () => {
  it('accepts blob, issue, pull, and commit URLs', () => {
    expect(shouldHandleGithubPaste('https://github.com/owner/repo/blob/main/a.ts#L10-L20')).toBe(
      true
    );
    expect(shouldHandleGithubPaste('https://github.com/owner/repo/issues/1')).toBe(true);
    expect(shouldHandleGithubPaste('https://example.com/a.ts')).toBe(false);
  });
});

describe('markdownFromGithubPasteResult', () => {
  const url = 'https://github.com/owner/repo/blob/main/secret.ts#L10-L20';

  it('uses the embed markdown on success', () => {
    expect(
      markdownFromGithubPasteResult(url, {
        success: true,
        kind: 'embed',
        markdown: '```ts\nx\n```',
      })
    ).toEqual({ insert: '```ts\nx\n```', error: null });
  });

  it('keeps the pasted URL when a private blob needs Connect', () => {
    expect(
      markdownFromGithubPasteResult(url, {
        success: false,
        error: GITHUB_CONNECT_REQUIRED,
        connectRequired: true,
      })
    ).toEqual({
      insert: url,
      error: GITHUB_CONNECT_REQUIRED,
    });
  });

  it('keeps the raw URL when a public fetch fails without asking to connect', () => {
    expect(
      markdownFromGithubPasteResult(url, { success: false, error: 'GitHub returned 500.' })
    ).toEqual({ insert: url, error: 'GitHub returned 500.' });
  });
});
