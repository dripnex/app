import { describe, expect, it } from 'vitest';
import { headingToSlug, scanMarkdown } from '../src/scan.js';

describe('scanMarkdown', () => {
  it('collects headings, tasks, embeds and wikilinks in one walk', () => {
    const md = [
      '# Title',
      '',
      '- [x] done',
      '- [ ] todo',
      'See [[Note A]] and ![[shot.png|Shot]]',
      'Also [[Note A#Heading|alias]]',
    ].join('\n');

    const scan = scanMarkdown(md);
    expect(scan.headings).toEqual([{ level: 1, text: 'Title', line: 1, slug: 'title' }]);
    expect(scan.tasks).toEqual({ total: 2, completed: 1 });
    expect(scan.embedTargets).toEqual(['shot.png']);
    expect(scan.embeds).toEqual([{ target: 'shot.png', display: 'Shot' }]);
    expect(scan.wikilinks).toEqual([
      { target: 'Note A' },
      { target: 'Note A', anchor: 'Heading', display: 'alias' },
    ]);
  });

  it('skips headings, tasks and links inside fenced code', () => {
    const md = [
      '# Real',
      '```md',
      '# Fake',
      '- [ ] not a task',
      '[[No]]',
      '![[no.png]]',
      '```',
      '## Also real',
      '- [ ] real task',
    ].join('\n');

    const scan = scanMarkdown(md);
    expect(scan.headings.map(h => h.text)).toEqual(['Real', 'Also real']);
    expect(scan.tasks).toEqual({ total: 1, completed: 0 });
    expect(scan.wikilinks).toEqual([]);
    expect(scan.embedTargets).toEqual([]);
  });

  it('does not treat embeds as wikilinks', () => {
    const scan = scanMarkdown('See [[note]] and ![[image.png]]');
    expect(scan.wikilinks).toEqual([{ target: 'note' }]);
    expect(scan.embedTargets).toEqual(['image.png']);
  });

  it('ignores empty hashes and closing hashes', () => {
    const scan = scanMarkdown('#\n##   \n### Done ###');
    expect(scan.headings).toEqual([{ level: 3, text: 'Done', line: 3, slug: 'done' }]);
  });

  it('skips tilde fences and inline code', () => {
    const md = ['~~~', '# Fake', '[[No]]', '~~~', 'See `[[inline]]` and ![[real.png]]'].join('\n');
    const scan = scanMarkdown(md);
    expect(scan.headings).toEqual([]);
    expect(scan.wikilinks).toEqual([]);
    expect(scan.embedTargets).toEqual(['real.png']);
  });

  it('dedupes embed targets case-insensitively', () => {
    const scan = scanMarkdown('![[a.png]] ![[A.PNG]] ![[b.png]]');
    expect(scan.embedTargets).toEqual(['a.png', 'b.png']);
  });
});

describe('headingToSlug', () => {
  it('matches GitHub-style anchors', () => {
    expect(headingToSlug('Hello World!')).toBe('hello-world');
    expect(headingToSlug('API Reference')).toBe('api-reference');
  });
});
