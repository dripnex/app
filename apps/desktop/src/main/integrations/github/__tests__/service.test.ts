import { describe, expect, it } from 'vitest';
import { noteFromIssue, parseIssueUrl, parseRepoSpec, parseWatcherSpec } from '../service';

describe('parseIssueUrl', () => {
  it('accepts a canonical issue URL', () => {
    expect(parseIssueUrl('https://github.com/dripnex/readide/issues/12')).toEqual({
      owner: 'dripnex',
      repo: 'readide',
      number: 12,
    });
  });

  it('rejects pull request and garbage URLs', () => {
    expect(parseIssueUrl('https://github.com/dripnex/readide/pull/12')).toBeNull();
    expect(parseIssueUrl('not-a-url')).toBeNull();
  });
});

describe('noteFromIssue', () => {
  it('builds markdown with a task tag and the source URL', () => {
    const note = noteFromIssue({
      title: 'Fix sync retry',
      body: 'Steps to reproduce',
      html_url: 'https://github.com/dripnex/readide/issues/1',
      labels: [{ name: 'bug' }],
    });
    expect(note).toContain('# Fix sync retry');
    expect(note).toContain('#task');
    expect(note).toContain('#github');
    expect(note).toContain('#bug');
    expect(note).toContain('https://github.com/dripnex/readide/issues/1');
    expect(note).toContain('Steps to reproduce');
  });
});

describe('parseWatcherSpec', () => {
  it('accepts owner/repo', () => {
    expect(parseRepoSpec('dripnex/readide')).toEqual({ owner: 'dripnex', repo: 'readide' });
    expect(parseWatcherSpec('dripnex/readide')).toEqual({
      kind: 'repo',
      label: 'dripnex/readide',
      owner: 'dripnex',
      repo: 'readide',
    });
  });

  it('accepts an issue URL', () => {
    expect(parseWatcherSpec('https://github.com/dripnex/readide/issues/12')).toMatchObject({
      kind: 'issue',
      owner: 'dripnex',
      repo: 'readide',
      number: 12,
    });
  });

  it('treats free text as a GitHub search', () => {
    expect(parseWatcherSpec('repo:dripnex/readide is:open')).toEqual({
      kind: 'search',
      label: 'repo:dripnex/readide is:open',
      query: 'repo:dripnex/readide is:open',
    });
  });

  it('rejects empty input', () => {
    expect(parseWatcherSpec('')).toBeNull();
    expect(parseWatcherSpec('  ')).toBeNull();
  });
});
