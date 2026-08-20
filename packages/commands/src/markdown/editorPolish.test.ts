import { describe, expect, it } from 'vitest';
import {
  checkedTaskMarks,
  checkedTaskTextOnLine,
  fenceAt,
  markdownLinkAt,
  markdownLinksInLine,
} from './editorPolish.js';

describe('checkedTaskTextOnLine', () => {
  it('returns the text after a checked bullet', () => {
    expect(checkedTaskTextOnLine('- [x] done')).toEqual({ from: 6, to: 10 });
  });

  it('accepts ordered, quoted, and uppercase checks', () => {
    expect(checkedTaskTextOnLine('1. [X] ship')).toEqual({ from: 7, to: 11 });
    expect(checkedTaskTextOnLine('> - [x] quoted')).toEqual({ from: 8, to: 14 });
  });

  it('ignores unchecked and empty items', () => {
    expect(checkedTaskTextOnLine('- [ ] open')).toBeNull();
    expect(checkedTaskTextOnLine('- [x]')).toBeNull();
    expect(checkedTaskTextOnLine('- [x]   ')).toBeNull();
  });
});

describe('checkedTaskMarks', () => {
  it('marks completed tasks and skips fenced lookalikes', () => {
    const doc = ['- [x] done', '- [ ] open', '```', '- [x] fake', '```', '1. [x] numbered'].join(
      '\n'
    );
    expect(checkedTaskMarks(doc)).toEqual([
      { from: 6, to: 10 },
      { from: doc.indexOf('numbered'), to: doc.length },
    ]);
  });
});

describe('markdownLinkAt', () => {
  it('finds a markdown link from the label or the url', () => {
    const line = 'see [Dripnex](https://dripnex.app) now';
    const hit = markdownLinkAt(line, line.indexOf('Dripnex'));
    expect(hit).toMatchObject({ url: 'https://dripnex.app', label: 'Dripnex' });
    expect(markdownLinkAt(line, line.indexOf('https'))?.url).toBe('https://dripnex.app');
    expect(markdownLinkAt(line, 0)).toBeNull();
  });

  it('skips images and wikilinks', () => {
    expect(markdownLinkAt('![img](https://x.com/a.png)', 3)).toBeNull();
    expect(markdownLinkAt('[[Note]]', 3)).toBeNull();
  });

  it('accepts autolinks and titled destinations', () => {
    expect(markdownLinkAt('<https://dripnex.app>', 2)?.url).toBe('https://dripnex.app');
    expect(markdownLinkAt('[a](https://x.com "Home")', 1)?.url).toBe('https://x.com');
    expect(markdownLinkAt('[a](<https://x.com>)', 1)?.url).toBe('https://x.com');
  });

  it('returns every link on a line', () => {
    const line = '[a](https://a.com) and [b](https://b.com)';
    expect(markdownLinksInLine(line).map(hit => hit.url)).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});

describe('fenceAt', () => {
  const doc = ['before', '```js', 'const x = 1', '```', 'after'].join('\n');

  it('returns the inner body when the cursor is in the fence', () => {
    const hit = fenceAt(doc, doc.indexOf('const'));
    expect(hit?.language).toBe('js');
    expect(hit?.body).toBe('const x = 1');
  });

  it('includes the opening and closing fence lines', () => {
    expect(fenceAt(doc, doc.indexOf('```js'))?.body).toBe('const x = 1');
    expect(fenceAt(doc, doc.lastIndexOf('```'))?.body).toBe('const x = 1');
  });

  it('is null outside the fence', () => {
    expect(fenceAt(doc, doc.indexOf('before'))).toBeNull();
    expect(fenceAt(doc, doc.indexOf('after'))).toBeNull();
  });

  it('copies an unclosed fence through the end of the document', () => {
    const open = '```\nstill going';
    expect(fenceAt(open, open.indexOf('still'))?.body).toBe('still going');
  });

  it('supports tilde fences', () => {
    const tildes = '~~~\nbody\n~~~';
    expect(fenceAt(tildes, tildes.indexOf('body'))?.body).toBe('body');
  });
});
