import { describe, expect, it } from 'vitest';
import {
  formatGithubBlobMarkdown,
  languageFromPath,
  parseGithubBlobUrl,
  parseGithubPasteUrl,
  sliceFileLines,
} from '../githubBlob';

const BLOB = 'https://github.com/owner/repo/blob/main/path/to/file.ts#L10-L20';

describe('parseGithubBlobUrl', () => {
  it('reads owner, repo, ref, path, and inclusive line range', () => {
    expect(parseGithubBlobUrl(BLOB)).toEqual({
      kind: 'blob',
      owner: 'owner',
      repo: 'repo',
      ref: 'main',
      path: 'path/to/file.ts',
      startLine: 10,
      endLine: 20,
      url: BLOB,
    });
  });

  it('accepts a single line, column ranges, and www', () => {
    expect(
      parseGithubBlobUrl('https://www.github.com/acme/app/blob/v1.0.0/src/a.py#L4')?.startLine
    ).toBe(4);
    expect(
      parseGithubBlobUrl('https://github.com/acme/app/blob/main/src/a.py#L4C1-L8C2')
    ).toMatchObject({ startLine: 4, endLine: 8 });
  });

  it('leaves line numbers null when the hash is missing', () => {
    expect(parseGithubBlobUrl('https://github.com/acme/app/blob/main/src/a.py')).toMatchObject({
      path: 'src/a.py',
      startLine: null,
      endLine: null,
    });
  });

  it('rejects issue, pull, and garbage URLs', () => {
    expect(parseGithubBlobUrl('https://github.com/acme/app/issues/12')).toBeNull();
    expect(parseGithubBlobUrl('https://github.com/acme/app/pull/12')).toBeNull();
    expect(parseGithubBlobUrl('not-a-url')).toBeNull();
  });
});

describe('parseGithubPasteUrl', () => {
  it('classifies issue, pull, and commit URLs', () => {
    expect(parseGithubPasteUrl('https://github.com/acme/app/issues/12')).toMatchObject({
      kind: 'issue',
      owner: 'acme',
      repo: 'app',
      number: 12,
    });
    expect(parseGithubPasteUrl('https://github.com/acme/app/pull/3')).toMatchObject({
      kind: 'pull',
      number: 3,
    });
    expect(parseGithubPasteUrl('https://github.com/acme/app/commit/abc123')).toMatchObject({
      kind: 'commit',
      sha: 'abc123',
    });
  });
});

describe('sliceFileLines', () => {
  const file = ['a', 'b', 'c', 'd', 'e'].join('\n') + '\n';

  it('slices an inclusive 1-indexed range and does not dump the file', () => {
    expect(sliceFileLines(file, 2, 4)).toEqual({ text: 'b\nc\nd', start: 2, end: 4 });
    expect(sliceFileLines(file, 2, 4)?.text).not.toContain('a');
    expect(sliceFileLines(file, 2, 4)?.text).not.toContain('e');
  });

  it('returns null when the start line is past the file', () => {
    expect(sliceFileLines(file, 9, 12)).toBeNull();
  });

  it('caps a huge range', () => {
    const many = Array.from({ length: 400 }, (_, i) => `L${i + 1}`).join('\n');
    const sliced = sliceFileLines(many, 1, 400, 10);
    expect(sliced).toEqual({
      text: Array.from({ length: 10 }, (_, i) => `L${i + 1}`).join('\n'),
      start: 1,
      end: 10,
    });
  });
});

describe('formatGithubBlobMarkdown', () => {
  it('emits a source link, language, highlight range, and sliced body', () => {
    const blob = parseGithubBlobUrl(BLOB)!;
    const md = formatGithubBlobMarkdown(blob, {
      text: 'const x = 1;\nconst y = 2;',
      start: 10,
      end: 20,
    });
    expect(md).toContain(`[owner/repo/path/to/file.ts#L10-L20](${BLOB})`);
    expect(md).toContain('```ts title=path/to/file.ts startLine=10 {10-20}');
    expect(md).toContain('const x = 1;');
    expect(md).not.toContain('line 9');
  });

  it('maps a file extension to a fence language', () => {
    expect(languageFromPath('src/a.ts')).toBe('ts');
    expect(languageFromPath('main.py')).toBe('python');
  });
});
