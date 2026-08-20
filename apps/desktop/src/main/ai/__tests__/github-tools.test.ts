import { describe, expect, it } from 'vitest';
import { formatIssueHits } from '../github-tools';

describe('formatIssueHits', () => {
  it('keeps title, url, state and repo slug', () => {
    expect(
      formatIssueHits([
        {
          title: 'Fix retry',
          html_url: 'https://github.com/dripnex/readide/issues/1',
          state: 'open',
          repository_url: 'https://api.github.com/repos/dripnex/readide',
        },
      ])
    ).toEqual([
      {
        title: 'Fix retry',
        url: 'https://github.com/dripnex/readide/issues/1',
        state: 'open',
        repo: 'dripnex/readide',
      },
    ]);
  });
});
