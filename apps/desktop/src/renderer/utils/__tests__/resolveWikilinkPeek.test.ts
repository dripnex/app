import { describe, expect, it } from 'vitest';
import { resolveWikilinkPeek } from '../resolveWikilinkPeek';

const notes = [
  { title: 'Home', content: '# Home\n\nWelcome to the lab.' },
  { title: 'Other', content: '# Other\n\nSkip me.' },
];

describe('resolveWikilinkPeek', () => {
  it('returns an excerpt for an existing title', async () => {
    await expect(resolveWikilinkPeek('home', async () => notes)).resolves.toEqual({
      kind: 'note',
      title: 'Home',
      excerpt: 'Welcome to the lab.',
    });
  });

  it('marks a missing title', async () => {
    await expect(resolveWikilinkPeek('Ghost', async () => notes)).resolves.toEqual({
      kind: 'missing',
      title: 'Ghost',
    });
  });

  it('ignores empty targets', async () => {
    await expect(resolveWikilinkPeek('  ', async () => notes)).resolves.toBeNull();
  });
});
