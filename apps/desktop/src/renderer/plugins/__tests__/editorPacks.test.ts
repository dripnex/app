import { describe, expect, it } from 'vitest';
import { csvFencePlan, parseDelimited } from '../csvPreview';
import {
  dailyNoteBody,
  dailyNoteTitle,
  findNoteByTitle,
  tomorrowDate,
  yesterdayDate,
} from '../dailyNote';
import {
  footnoteIdFromHref,
  insertFootnotePlan,
  jumpFootnoteTarget,
  nextFootnoteIndex,
  nextFootnoteRange,
  previousFootnoteRange,
} from '../footnotes';
import { journalStamp } from '../journal';
import { wikilinkFromTitle } from '../copyNote';
import { taskStatsLabel } from '../noteStats';
import { relatedBySharedTags } from '../backlinks';
import { pickRandomId } from '../randomNote';
import { orphanNoteId } from '../orphanNote';
import { hubNoteId } from '../hubNote';
import { spokeNoteId } from '../spokeNote';
import { nextDanglingWikilink, unresolvedTargets } from '../danglingWikilink';
import { unwrapWikilinkPlan, wrapWikilinkPlan } from '../wrapWikilink';
import { unwrapEmbedPlan, wrapEmbedPlan } from '../wrapEmbed';
import { nextEmbedRange, previousEmbedRange } from '../jumpEmbed';
import { nextTagRange, previousTagRange } from '../jumpTag';
import { unwrapTagPlan, wrapTagPlan } from '../wrapTag';
import { unwrapMathPlan, wrapMathPlan } from '../wrapMath';
import { nextMathRange, previousMathRange } from '../jumpMath';
import { unwrapImagePlan, wrapImagePlan } from '../wrapImage';
import { unwrapLinkPlan, wrapLinkPlan } from '../wrapLink';
import { unwrapCodePlan, wrapCodePlan } from '../wrapCode';
import { unwrapStrikePlan, wrapStrikePlan } from '../wrapStrike';
import { nextStrikeRange, previousStrikeRange } from '../jumpStrike';
import { nextWikilinkRange, previousWikilinkRange } from '../jumpWikilink';
import { nextLinkRange, previousLinkRange } from '../jumpLink';
import { nextImageRange, previousImageRange } from '../jumpImage';
import { nextFenceRange, previousFenceRange } from '../jumpFence';
import { nextTableRange, previousTableRange } from '../jumpTable';
import { nextAlertRange, previousAlertRange } from '../jumpAlert';
import { nextQuoteRange, previousQuoteRange } from '../jumpQuote';
import { nextListRange, previousListRange } from '../jumpList';
import { nextHrRange, previousHrRange } from '../jumpHr';
import { duplicateTitleId } from '../duplicateTitle';
import { stubNoteId } from '../stubNote';
import { longestNoteId } from '../longestNote';
import { staleNoteId } from '../staleNote';
import { newestNoteId } from '../newestNote';
import { untaggedNoteId } from '../untaggedNote';
import { mostTaggedNoteId } from '../mostTaggedNote';
import { unlinkedNoteId } from '../unlinkedNote';
import { cycleHeadingAtOffset, cycleHeadingLine } from '../cycleHeading';
import { cycleListAtOffset, cycleListLine } from '../cycleList';
import { cycleQuoteAtOffset, cycleQuoteLine } from '../cycleQuote';
import { cycleAlertAtOffset, cycleAlertLine } from '../cycleAlert';
import { nextHeadingRange, previousHeadingRange } from '../jumpHeading';
import {
  nextCompletedTaskRange,
  nextIncompleteTaskRange,
  previousCompletedTaskRange,
  previousIncompleteTaskRange,
} from '../jumpTask';
import { toggleTaskAtOffset, toggleTaskMarkAtOffset } from '../taskToggle';
import { PALETTE_LIBRARY } from '../../themes/paletteLibrary';
import { RETIRED_BUNDLED_THEME_IDS } from '../../themes/officialThemes';

describe('footnotes', () => {
  it('inserts the next index and a definition', () => {
    expect(nextFootnoteIndex('Hello [^1] and [^3]')).toBe(4);
    const plan = insertFootnotePlan('See here', 4, 8);
    expect(plan.text).toBe('here[^1]');
    expect(plan.definition).toBe('\n\n[^1]: ');
  });

  it('jumps between a mark and its definition without rewriting the note', () => {
    const md = 'See here[^1].\n\n[^1]: the note';
    expect(jumpFootnoteTarget(md, 10)).toEqual({ from: 15, to: 20 });
    expect(jumpFootnoteTarget(md, 16)).toEqual({ from: 8, to: 12 });
    expect(jumpFootnoteTarget(md, 0)).toBeNull();
  });

  it('reads GFM footnote hrefs from preview', () => {
    expect(footnoteIdFromHref('#user-content-fn-1')).toBe('1');
    expect(footnoteIdFromHref('#fnref-note')).toBe('note');
    expect(footnoteIdFromHref('https://example.com')).toBeNull();
  });

  it('jumps to the next footnote mark and skips fences and definitions', () => {
    const md =
      'See here[^1] and [^note].\n```\n[^1]: fake\n```\nalso[^2]\n[^1]: real\n[^note]: named\n[^2]: two';
    const one = md.indexOf('[^1]');
    const note = md.indexOf('[^note]');
    const two = md.indexOf('[^2]');
    expect(nextFootnoteRange(md, 0)).toEqual({ from: one, to: one + '[^1]'.length });
    expect(nextFootnoteRange(md, one)).toEqual({ from: note, to: note + '[^note]'.length });
    expect(nextFootnoteRange(md, note)).toEqual({ from: two, to: two + '[^2]'.length });
    expect(nextFootnoteRange(md, two)).toEqual({ from: one, to: one + '[^1]'.length });
    expect(previousFootnoteRange(md, one)).toEqual({ from: two, to: two + '[^2]'.length });
    expect(nextFootnoteRange('[^1]: only a definition', 0)).toBeNull();
    expect(previousFootnoteRange('para only', 0)).toBeNull();
  });
});

describe('taskToggle', () => {
  it('checks and unchecks the line under the cursor', () => {
    const md = '- [ ] one\n- [x] two';
    expect(toggleTaskAtOffset(md, 3)).toEqual({ from: 2, to: 5, text: '[x]' });
    expect(toggleTaskAtOffset(md, 14)?.text).toBe('[ ]');
    expect(toggleTaskAtOffset('plain', 0)).toBeNull();
    const fenced = '```\n- [ ] code\n```\n- [ ] real';
    expect(toggleTaskAtOffset(fenced, fenced.indexOf('[ ] code') + 1)).toBeNull();
    expect(toggleTaskAtOffset(fenced, fenced.indexOf('[ ] real') + 1)?.text).toBe('[x]');
    expect(toggleTaskAtOffset('+ [ ] plus', 4)?.text).toBe('[x]');
    expect(toggleTaskAtOffset('1. [ ] numbered', 5)?.text).toBe('[x]');
    expect(toggleTaskAtOffset('1) [x] paren', 5)?.text).toBe('[ ]');
    expect(toggleTaskAtOffset('- [ ]text', 3)).toBeNull();
    expect(toggleTaskAtOffset('- [ ]', 3)?.text).toBe('[x]');
  });

  it('click only toggles when the pointer is on the checkbox mark', () => {
    const md = '- [ ] one';
    expect(toggleTaskMarkAtOffset(md, 3)).toEqual({ from: 2, to: 5, text: '[x]' });
    expect(toggleTaskMarkAtOffset(md, 7)).toBeNull();
  });
});

describe('danglingWikilink', () => {
  it('jumps to unresolved marks and skips embeds, fences, and resolved titles', () => {
    expect(
      unresolvedTargets([
        { targetTitle: 'Missing', resolved: false },
        { targetTitle: 'Exists', resolved: true },
        { targetTitle: ' missing ', resolved: false },
      ])
    ).toEqual(['Missing']);

    const md = 'See [[Exists]] and [[Missing]]\n```\n[[Missing]]\n```\n![[Missing]] [[Gone]]';
    expect(nextDanglingWikilink(md, ['Missing', 'Gone'], 0)).toEqual({ from: 19, to: 30 });
    expect(nextDanglingWikilink(md, ['Missing', 'Gone'], 19)).toEqual({ from: 64, to: 72 });
    expect(nextDanglingWikilink(md, ['Missing', 'Gone'], 64)).toEqual({ from: 19, to: 30 });
    expect(nextDanglingWikilink('See [[Exists]]', ['Missing'], 0)).toBeNull();
  });
});

describe('jumpWikilink', () => {
  it('jumps to the next wikilink and skips fences and embeds', () => {
    const md = 'See [[Exists]] and [[Missing]]\n```\n[[Missing]]\n```\n![[Missing]] [[Gone]]';
    expect(nextWikilinkRange(md, 0)).toEqual({ from: 4, to: 14 });
    expect(nextWikilinkRange(md, 4)).toEqual({ from: 19, to: 30 });
    expect(nextWikilinkRange(md, 19)).toEqual({ from: 64, to: 72 });
    expect(nextWikilinkRange(md, 64)).toEqual({ from: 4, to: 14 });
    expect(previousWikilinkRange(md, 4)).toEqual({ from: 64, to: 72 });
    expect(previousWikilinkRange(md, 64)).toEqual({ from: 19, to: 30 });
    expect(nextWikilinkRange('para only', 0)).toBeNull();
    expect(previousWikilinkRange('See ![[embed]]', 0)).toBeNull();
  });
});

describe('jumpLink', () => {
  it('jumps to the next Markdown link and skips fences and images', () => {
    const md =
      'See [a](https://a.test) and [b](https://b.test)\n```\n[c](https://c.test)\n```\n![img](x.png) [d](https://d.test)';
    const a = md.indexOf('[a]');
    const b = md.indexOf('[b]');
    const d = md.indexOf('[d]');
    expect(nextLinkRange(md, 0)).toEqual({ from: a, to: a + '[a](https://a.test)'.length });
    expect(nextLinkRange(md, a)).toEqual({ from: b, to: b + '[b](https://b.test)'.length });
    expect(nextLinkRange(md, b)).toEqual({ from: d, to: d + '[d](https://d.test)'.length });
    expect(nextLinkRange(md, d)).toEqual({ from: a, to: a + '[a](https://a.test)'.length });
    expect(previousLinkRange(md, a)).toEqual({ from: d, to: d + '[d](https://d.test)'.length });
    expect(nextLinkRange('para only', 0)).toBeNull();
    expect(previousLinkRange('See ![img](x.png)', 0)).toBeNull();
  });
});

describe('jumpImage', () => {
  it('jumps to the next Markdown image and skips fences, links, and embeds', () => {
    const md =
      'See ![a](a.png) and [b](https://b.test)\n```\n![c](c.png)\n```\n![[embed]] ![](d.png) ![e](<e f.png>)';
    const a = md.indexOf('![a]');
    const d = md.indexOf('![](d.png)');
    const e = md.indexOf('![e]');
    expect(nextImageRange(md, 0)).toEqual({ from: a, to: a + '![a](a.png)'.length });
    expect(nextImageRange(md, a)).toEqual({ from: d, to: d + '![](d.png)'.length });
    expect(nextImageRange(md, d)).toEqual({ from: e, to: e + '![e](<e f.png>)'.length });
    expect(nextImageRange(md, e)).toEqual({ from: a, to: a + '![a](a.png)'.length });
    expect(previousImageRange(md, a)).toEqual({ from: e, to: e + '![e](<e f.png>)'.length });
    expect(nextImageRange('See [a](https://a.test)', 0)).toBeNull();
    expect(previousImageRange('See ![[embed]]', 0)).toBeNull();
  });
});

describe('jumpAlert', () => {
  it('jumps to the next GitHub alert and skips quote bodies and fences', () => {
    const md =
      'para\n> [!NOTE]\n> keep\n\n> just a quote\n\n```\n> [!TIP]\n```\n> [!warning]\n> body';
    const note = md.indexOf('> [!NOTE]');
    const warning = md.indexOf('> [!warning]');
    const body = md.indexOf('> keep');
    expect(nextAlertRange(md, 0)).toEqual({ from: note, to: note + '> [!NOTE]'.length });
    expect(nextAlertRange(md, note)).toEqual({
      from: warning,
      to: warning + '> [!warning]'.length,
    });
    expect(nextAlertRange(md, body)).toEqual({
      from: warning,
      to: warning + '> [!warning]'.length,
    });
    expect(nextAlertRange(md, warning)).toEqual({ from: note, to: note + '> [!NOTE]'.length });
    expect(previousAlertRange(md, body)).toEqual({ from: note, to: note + '> [!NOTE]'.length });
    expect(previousAlertRange(md, note)).toEqual({
      from: warning,
      to: warning + '> [!warning]'.length,
    });
    expect(nextAlertRange('> just a quote', 0)).toBeNull();
    expect(previousAlertRange('para only', 0)).toBeNull();
  });
});

describe('jumpQuote', () => {
  it('jumps to the next quote opener and skips bodies, alerts, and fences', () => {
    const md = 'para\n> hello\n> keep\n\n> [!NOTE]\n> alert body\n\n```\n> fenced\n```\n> world';
    const hello = md.indexOf('> hello');
    const world = md.indexOf('> world');
    const keep = md.indexOf('> keep');
    expect(nextQuoteRange(md, 0)).toEqual({ from: hello, to: hello + '> hello'.length });
    expect(nextQuoteRange(md, hello)).toEqual({ from: world, to: world + '> world'.length });
    expect(nextQuoteRange(md, keep)).toEqual({ from: world, to: world + '> world'.length });
    expect(nextQuoteRange(md, world)).toEqual({ from: hello, to: hello + '> hello'.length });
    expect(previousQuoteRange(md, keep)).toEqual({ from: hello, to: hello + '> hello'.length });
    expect(previousQuoteRange(md, hello)).toEqual({ from: world, to: world + '> world'.length });
    expect(nextQuoteRange('> [!NOTE]\n> body', 0)).toBeNull();
    expect(previousQuoteRange('para only', 0)).toBeNull();
  });
});

describe('jumpList', () => {
  it('jumps to the next list opener and skips body items, HRs, and fences', () => {
    const md = 'para\n- hello\n- keep\n\n---\n\n```\n- fenced\n```\n1. world\n2. more';
    const hello = md.indexOf('- hello');
    const world = md.indexOf('1. world');
    const keep = md.indexOf('- keep');
    expect(nextListRange(md, 0)).toEqual({ from: hello, to: hello + '- hello'.length });
    expect(nextListRange(md, hello)).toEqual({ from: world, to: world + '1. world'.length });
    expect(nextListRange(md, keep)).toEqual({ from: world, to: world + '1. world'.length });
    expect(nextListRange(md, world)).toEqual({ from: hello, to: hello + '- hello'.length });
    expect(previousListRange(md, keep)).toEqual({ from: hello, to: hello + '- hello'.length });
    expect(previousListRange(md, hello)).toEqual({ from: world, to: world + '1. world'.length });
    expect(nextListRange('---\npara only', 0)).toBeNull();
    expect(previousListRange('para only', 0)).toBeNull();
  });
});

describe('jumpTable', () => {
  it('jumps to the next table opener and skips body rows and fences', () => {
    const md =
      'para\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```\n| fake |\n```\n| c | d |\n| --- | --- |';
    const a = md.indexOf('| a |');
    const c = md.indexOf('| c |');
    const body = md.indexOf('| 1 |');
    expect(nextTableRange(md, 0)).toEqual({ from: a, to: a + '| a | b |'.length });
    expect(nextTableRange(md, a)).toEqual({ from: c, to: c + '| c | d |'.length });
    expect(nextTableRange(md, body)).toEqual({ from: c, to: c + '| c | d |'.length });
    expect(nextTableRange(md, c)).toEqual({ from: a, to: a + '| a | b |'.length });
    expect(previousTableRange(md, body)).toEqual({ from: a, to: a + '| a | b |'.length });
    expect(previousTableRange(md, a)).toEqual({ from: c, to: c + '| c | d |'.length });
    expect(nextTableRange('para | not a table', 0)).toBeNull();
    expect(previousTableRange('para only', 0)).toBeNull();
    const loose = 'a | b\n--- | ---\nc | d';
    expect(nextTableRange(loose, 0)).toEqual({ from: 0, to: 'a | b'.length });
  });
});

describe('jumpFence', () => {
  it('jumps to the next fence opener and skips closers', () => {
    const md = 'para\n```js\ncode\n```\nmore\n~~~\ntext\n~~~';
    const js = md.indexOf('```js');
    const tilde = md.indexOf('~~~');
    expect(nextFenceRange(md, 0)).toEqual({ from: js, to: js + 5 });
    expect(nextFenceRange(md, js)).toEqual({ from: tilde, to: tilde + 3 });
    expect(nextFenceRange(md, js + 8)).toEqual({ from: tilde, to: tilde + 3 });
    expect(nextFenceRange(md, tilde)).toEqual({ from: js, to: js + 5 });
    expect(previousFenceRange(md, js)).toEqual({ from: tilde, to: tilde + 3 });
    expect(previousFenceRange(md, js + 8)).toEqual({ from: js, to: js + 5 });
    expect(nextFenceRange('para only', 0)).toBeNull();
  });
});

describe('jumpHr', () => {
  it('jumps to the next thematic break and skips setext underlines and fences', () => {
    const md = 'para\n\n---\n\nHeading\n---\n\n```\n***\n```\n***\nmore\n- - -';
    const dash = md.indexOf('---');
    const stars = md.lastIndexOf('***');
    const spaced = md.indexOf('- - -');
    expect(nextHrRange(md, 0)).toEqual({ from: dash, to: dash + 3 });
    expect(nextHrRange(md, dash)).toEqual({ from: stars, to: stars + 3 });
    expect(nextHrRange(md, stars)).toEqual({ from: spaced, to: spaced + 5 });
    expect(nextHrRange(md, spaced)).toEqual({ from: dash, to: dash + 3 });
    expect(previousHrRange(md, stars)).toEqual({ from: dash, to: dash + 3 });
    expect(previousHrRange(md, dash)).toEqual({ from: spaced, to: spaced + 5 });
    expect(nextHrRange('Heading\n---', 0)).toBeNull();
    expect(previousHrRange('para only', 0)).toBeNull();
  });
});

describe('wrapImage', () => {
  it('wraps alt text, a url, or the cursor without rewriting the rest of the note', () => {
    expect(wrapImagePlan('See cat', 4, 7)).toEqual({
      from: 4,
      to: 7,
      text: '![cat]()',
      cursor: 11,
    });
    expect(wrapImagePlan('Hello', 5, 5)).toEqual({
      from: 5,
      to: 5,
      text: '![]()',
      cursor: 7,
    });
    expect(wrapImagePlan('https://a.test/x.png', 0, 20)).toEqual({
      from: 0,
      to: 20,
      text: '![](https://a.test/x.png)',
      cursor: 25,
    });
    expect(wrapImagePlan('photo.jpg', 0, 9)).toEqual({
      from: 0,
      to: 9,
      text: '![](photo.jpg)',
      cursor: 14,
    });
    expect(wrapImagePlan('![cat](x.png)', 0, 13)).toBeNull();
    expect(wrapImagePlan('a\nb', 0, 3)).toBeNull();
    expect(wrapImagePlan('a[b', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n```\ncat\n```\n';
    expect(wrapImagePlan(fenced, fenced.indexOf('cat'), fenced.indexOf('cat') + 3)).toBeNull();
  });

  it('unwraps the mark under the cursor and keeps the alt', () => {
    expect(unwrapImagePlan('See ![cat](x.png)', 6, 6)).toEqual({
      from: 4,
      to: 17,
      text: 'cat',
      cursor: 7,
    });
    expect(unwrapImagePlan('See ![](photo.jpg)', 4, 18)).toEqual({
      from: 4,
      to: 18,
      text: 'photo.jpg',
      cursor: 13,
    });
    expect(unwrapImagePlan('See ![](<a b.png>)', 6, 6)).toEqual({
      from: 4,
      to: 18,
      text: 'a b.png',
      cursor: 11,
    });
    expect(unwrapImagePlan('See ![]()', 6, 6)).toBeNull();
    expect(unwrapImagePlan('See [cat](x.png)', 6, 6)).toBeNull();
    const fenced = 'para\n```\n![cat](x.png)\n```\n';
    expect(
      unwrapImagePlan(fenced, fenced.indexOf('![cat]') + 2, fenced.indexOf('![cat]') + 2)
    ).toBeNull();
  });
});

describe('wrapLink', () => {
  it('wraps label text, a url, or the cursor without rewriting the rest of the note', () => {
    expect(wrapLinkPlan('See cat', 4, 7)).toEqual({
      from: 4,
      to: 7,
      text: '[cat]()',
      cursor: 10,
    });
    expect(wrapLinkPlan('a]b', 0, 3)).toBeNull();
    expect(wrapLinkPlan('Hello', 5, 5)).toEqual({
      from: 5,
      to: 5,
      text: '[]()',
      cursor: 6,
    });
    expect(wrapLinkPlan('https://a.test/x', 0, 16)).toEqual({
      from: 0,
      to: 16,
      text: '[](https://a.test/x)',
      cursor: 1,
    });
    expect(wrapLinkPlan('https://a.test/a)b', 0, 18)).toEqual({
      from: 0,
      to: 18,
      text: '[](<https://a.test/a)b>)',
      cursor: 1,
    });
    expect(wrapLinkPlan('[cat](x.png)', 0, 12)).toBeNull();
    expect(wrapLinkPlan('![cat](x.png)', 0, 13)).toBeNull();
    expect(wrapLinkPlan('[[here]]', 0, 8)).toBeNull();
    expect(wrapLinkPlan('a\nb', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n```\ncat\n```\n';
    expect(wrapLinkPlan(fenced, fenced.indexOf('cat'), fenced.indexOf('cat') + 3)).toBeNull();
  });

  it('unwraps the mark under the cursor and keeps the label', () => {
    expect(unwrapLinkPlan('See [cat](x.png)', 6, 6)).toEqual({
      from: 4,
      to: 16,
      text: 'cat',
      cursor: 7,
    });
    expect(unwrapLinkPlan('See [](https://a.test)', 4, 22)).toEqual({
      from: 4,
      to: 22,
      text: 'https://a.test',
      cursor: 18,
    });
    expect(unwrapLinkPlan('See [](<a b.html>)', 6, 6)).toEqual({
      from: 4,
      to: 18,
      text: 'a b.html',
      cursor: 12,
    });
    expect(unwrapLinkPlan('See []()', 6, 6)).toBeNull();
    expect(unwrapLinkPlan('See ![cat](x.png)', 6, 6)).toBeNull();
    expect(unwrapLinkPlan('See [lab](https://example.test/a_(b))', 6, 6)).toEqual({
      from: 4,
      to: 37,
      text: 'lab',
      cursor: 7,
    });
    expect(unwrapLinkPlan('See [a [b] c](x)', 8, 8)).toEqual({
      from: 4,
      to: 16,
      text: 'a [b] c',
      cursor: 11,
    });
    const fenced = 'para\n```\n[cat](x.png)\n```\n';
    expect(
      unwrapLinkPlan(fenced, fenced.indexOf('[cat]') + 2, fenced.indexOf('[cat]') + 2)
    ).toBeNull();
  });
});

describe('wrapCode', () => {
  it('wraps the selection or the cursor without rewriting the rest of the note', () => {
    expect(wrapCodePlan('See cat', 4, 7)).toEqual({
      from: 4,
      to: 7,
      text: '`cat`',
      cursor: 9,
    });
    expect(wrapCodePlan('Hello', 5, 5)).toEqual({
      from: 5,
      to: 5,
      text: '``',
      cursor: 6,
    });
    expect(wrapCodePlan('`cat`', 0, 5)).toBeNull();
    expect(wrapCodePlan('a`b', 0, 3)).toBeNull();
    expect(wrapCodePlan('a\nb', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n```\ncat\n```\n';
    expect(wrapCodePlan(fenced, fenced.indexOf('cat'), fenced.indexOf('cat') + 3)).toBeNull();
  });

  it('unwraps the mark under the cursor', () => {
    expect(unwrapCodePlan('See `cat`', 6, 6)).toEqual({
      from: 4,
      to: 9,
      text: 'cat',
      cursor: 7,
    });
    expect(unwrapCodePlan('See ``', 4, 6)).toBeNull();
    expect(unwrapCodePlan('See ```foo```', 8, 8)).toEqual({
      from: 4,
      to: 13,
      text: 'foo',
      cursor: 7,
    });
    const inner = 'literal `' + ' #tag';
    const nested = 'See ``' + inner + '``';
    expect(unwrapCodePlan(nested, nested.indexOf('#tag'), nested.indexOf('#tag'))).toEqual({
      from: 4,
      to: nested.length,
      text: inner,
      cursor: 4 + inner.length,
    });
    const fenced = 'para\n```\n`cat`\n```\n';
    expect(
      unwrapCodePlan(fenced, fenced.indexOf('`cat`') + 2, fenced.indexOf('`cat`') + 2)
    ).toBeNull();
    const across = 'See `literal\n#tag`';
    expect(unwrapCodePlan(across, across.indexOf('#tag'), across.indexOf('#tag'))).toEqual({
      from: 4,
      to: across.length,
      text: 'literal\n#tag',
      cursor: 4 + 'literal\n#tag'.length,
    });
  });
});

describe('wrapWikilink', () => {
  it('wraps the selection and leaves an empty mark at the cursor', () => {
    expect(wrapWikilinkPlan('See here', 4, 8)).toEqual({
      from: 4,
      to: 8,
      text: '[[here]]',
      cursor: 12,
    });
    expect(wrapWikilinkPlan('Hello', 5, 5)).toEqual({
      from: 5,
      to: 5,
      text: '[[]]',
      cursor: 7,
    });
    expect(wrapWikilinkPlan('[[here]]', 0, 8)).toBeNull();
    expect(wrapWikilinkPlan('a\nb', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n```\nhere\n```\n';
    expect(wrapWikilinkPlan(fenced, fenced.indexOf('here'), fenced.indexOf('here') + 4)).toBeNull();
  });

  it('unwraps the mark under the cursor and keeps the alias', () => {
    expect(unwrapWikilinkPlan('See [[here]]', 6, 6)).toEqual({
      from: 4,
      to: 12,
      text: 'here',
      cursor: 8,
    });
    expect(unwrapWikilinkPlan('See [[Note|shown]]', 4, 18)).toEqual({
      from: 4,
      to: 18,
      text: 'shown',
      cursor: 9,
    });
    expect(unwrapWikilinkPlan('See [[Note#H]]', 6, 6)).toEqual({
      from: 4,
      to: 14,
      text: 'Note#H',
      cursor: 10,
    });
    expect(unwrapWikilinkPlan('See here', 4, 8)).toBeNull();
    expect(unwrapWikilinkPlan('See ![[here]]', 7, 7)).toBeNull();
    const fenced = 'para\n```\n[[here]]\n```\n';
    expect(
      unwrapWikilinkPlan(fenced, fenced.indexOf('[[here]]') + 2, fenced.indexOf('[[here]]') + 2)
    ).toBeNull();
  });
});

describe('wrapEmbed', () => {
  it('wraps the selection, promotes a wikilink, and leaves an empty mark at the cursor', () => {
    expect(wrapEmbedPlan('See here', 4, 8)).toEqual({
      from: 4,
      to: 8,
      text: '![[here]]',
      cursor: 13,
    });
    expect(wrapEmbedPlan('Hello', 5, 5)).toEqual({
      from: 5,
      to: 5,
      text: '![[]]',
      cursor: 8,
    });
    expect(wrapEmbedPlan('See [[here]]', 4, 12)).toEqual({
      from: 4,
      to: 12,
      text: '![[here]]',
      cursor: 13,
    });
    expect(wrapEmbedPlan('![[here]]', 0, 9)).toBeNull();
    expect(wrapEmbedPlan('![cat](x.png)', 0, 13)).toBeNull();
    expect(wrapEmbedPlan('a\nb', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n```\nhere\n```\n';
    expect(wrapEmbedPlan(fenced, fenced.indexOf('here'), fenced.indexOf('here') + 4)).toBeNull();
  });

  it('unwraps the mark under the cursor and keeps the alias', () => {
    expect(unwrapEmbedPlan('See ![[here]]', 6, 6)).toEqual({
      from: 4,
      to: 13,
      text: 'here',
      cursor: 8,
    });
    expect(unwrapEmbedPlan('See ![[Note|shown]]', 4, 19)).toEqual({
      from: 4,
      to: 19,
      text: 'shown',
      cursor: 9,
    });
    expect(unwrapEmbedPlan('See ![[Note#H]]', 6, 6)).toEqual({
      from: 4,
      to: 15,
      text: 'Note#H',
      cursor: 10,
    });
    expect(unwrapEmbedPlan('See [[here]]', 6, 6)).toBeNull();
    expect(unwrapEmbedPlan('See ![cat](x.png)', 6, 6)).toBeNull();
    const fenced = 'para\n```\n![[here]]\n```\n';
    expect(
      unwrapEmbedPlan(fenced, fenced.indexOf('![[here]]') + 3, fenced.indexOf('![[here]]') + 3)
    ).toBeNull();
  });
});

describe('jumpEmbed', () => {
  it('jumps to the next embed and skips fences, images, and wikilinks', () => {
    const md =
      'See ![[diagram.png]] and [[note]]\n```\n![[fake.png]]\n```\n![img](x.png) ![[spec.pdf|PDF]] ![[]]';
    const diagram = md.indexOf('![[diagram.png]]');
    const spec = md.indexOf('![[spec.pdf|PDF]]');
    expect(nextEmbedRange(md, 0)).toEqual({
      from: diagram,
      to: diagram + '![[diagram.png]]'.length,
    });
    expect(nextEmbedRange(md, diagram)).toEqual({
      from: spec,
      to: spec + '![[spec.pdf|PDF]]'.length,
    });
    expect(nextEmbedRange(md, spec)).toEqual({
      from: diagram,
      to: diagram + '![[diagram.png]]'.length,
    });
    expect(previousEmbedRange(md, diagram)).toEqual({
      from: spec,
      to: spec + '![[spec.pdf|PDF]]'.length,
    });
    expect(previousEmbedRange(md, spec)).toEqual({
      from: diagram,
      to: diagram + '![[diagram.png]]'.length,
    });
    expect(nextEmbedRange('See [[note]]', 0)).toBeNull();
    expect(previousEmbedRange('See ![img](x.png)', 0)).toBeNull();
    expect(nextEmbedRange('See ![[]]', 0)).toBeNull();
  });
});

describe('jumpTag', () => {
  it('jumps to the next #tag and skips headings, fences, inline code, and numeric hashes', () => {
    const md =
      '# Title\nSee #inbox and #Work\n```\n#fake\n```\nalso `#nope` #my-tag #123bad [[Note#H]]';
    const inbox = md.indexOf('#inbox');
    const work = md.indexOf('#Work');
    const mine = md.indexOf('#my-tag');
    expect(nextTagRange(md, 0)).toEqual({ from: inbox, to: inbox + '#inbox'.length });
    expect(nextTagRange(md, inbox)).toEqual({ from: work, to: work + '#Work'.length });
    expect(nextTagRange(md, work)).toEqual({ from: mine, to: mine + '#my-tag'.length });
    expect(nextTagRange(md, mine)).toEqual({ from: inbox, to: inbox + '#inbox'.length });
    expect(previousTagRange(md, inbox)).toEqual({ from: mine, to: mine + '#my-tag'.length });
    expect(previousTagRange(md, mine)).toEqual({ from: work, to: work + '#Work'.length });
    expect(nextTagRange('# Title only', 0)).toBeNull();
    expect(previousTagRange('See `#code` and [[Note#H]]', 0)).toBeNull();
    expect(nextTagRange('#123bad', 0)).toBeNull();
  });
});

describe('wrapTag', () => {
  it('wraps a letter-first token and leaves a hash at a word boundary', () => {
    expect(wrapTagPlan('See inbox', 4, 9)).toEqual({
      from: 4,
      to: 9,
      text: '#inbox',
      cursor: 10,
    });
    expect(wrapTagPlan('Hi ', 3, 3)).toEqual({
      from: 3,
      to: 3,
      text: '#',
      cursor: 4,
    });
    expect(wrapTagPlan('#inbox', 0, 6)).toBeNull();
    expect(wrapTagPlan('my tag', 0, 6)).toBeNull();
    expect(wrapTagPlan('123bad', 0, 6)).toBeNull();
    expect(wrapTagPlan('foobar', 3, 6)).toBeNull();
    expect(wrapTagPlan('Hello', 5, 5)).toBeNull();
    expect(wrapTagPlan('a\nb', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n```\ninbox\n```\n';
    expect(wrapTagPlan(fenced, fenced.indexOf('inbox'), fenced.indexOf('inbox') + 5)).toBeNull();
  });

  it('unwraps the mark under the cursor', () => {
    expect(unwrapTagPlan('See #inbox', 6, 6)).toEqual({
      from: 4,
      to: 10,
      text: 'inbox',
      cursor: 9,
    });
    expect(unwrapTagPlan('See #my-tag', 4, 11)).toEqual({
      from: 4,
      to: 11,
      text: 'my-tag',
      cursor: 10,
    });
    expect(unwrapTagPlan('# Title only', 0, 0)).toBeNull();
    expect(unwrapTagPlan('See `#code`', 6, 6)).toBeNull();
    expect(unwrapTagPlan('See ``' + 'literal `' + ' #tag' + '``', 16, 16)).toBeNull();
    expect(unwrapTagPlan('See `literal\n#tag`', 13, 13)).toBeNull();
    expect(unwrapTagPlan('See [[Note#H]]', 10, 10)).toBeNull();
    const fenced = 'para\n```\n#inbox\n```\n';
    expect(
      unwrapTagPlan(fenced, fenced.indexOf('#inbox') + 2, fenced.indexOf('#inbox') + 2)
    ).toBeNull();
  });
});

describe('wrapMath', () => {
  it('wraps the selection as inline math and leaves an empty mark at the cursor', () => {
    expect(wrapMathPlan('See x^2', 4, 7)).toEqual({
      from: 4,
      to: 7,
      text: '$x^2$',
      cursor: 9,
    });
    expect(wrapMathPlan('Hello', 5, 5)).toEqual({
      from: 5,
      to: 5,
      text: '$$',
      cursor: 6,
    });
    expect(wrapMathPlan('$x^2$', 0, 5)).toBeNull();
    expect(wrapMathPlan('$$E$$', 0, 5)).toBeNull();
    expect(wrapMathPlan('a\nb', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n```\nx^2\n```\n';
    expect(wrapMathPlan(fenced, fenced.indexOf('x^2'), fenced.indexOf('x^2') + 3)).toBeNull();
  });

  it('unwraps inline or display math under the cursor', () => {
    expect(unwrapMathPlan('See $x^2$', 6, 6)).toEqual({
      from: 4,
      to: 9,
      text: 'x^2',
      cursor: 7,
    });
    expect(unwrapMathPlan('See $$E=mc^2$$', 6, 6)).toEqual({
      from: 4,
      to: 14,
      text: 'E=mc^2',
      cursor: 10,
    });
    expect(unwrapMathPlan('See $ x $', 6, 6)).toBeNull();
    expect(unwrapMathPlan('See 12$', 6, 6)).toBeNull();
    const fenced = 'para\n```\n$x$\n```\n';
    expect(unwrapMathPlan(fenced, fenced.indexOf('$x$') + 1, fenced.indexOf('$x$') + 1)).toBeNull();
  });
});

describe('jumpMath', () => {
  it('jumps to the next math mark and skips fences and spaced dollars', () => {
    const md = 'See $x^2$ and $$E=mc^2$$\n```\n$fake$\n```\n$ y $ $a$';
    const x = md.indexOf('$x^2$');
    const display = md.indexOf('$$E=mc^2$$');
    const a = md.indexOf('$a$');
    expect(nextMathRange(md, 0)).toEqual({ from: x, to: x + '$x^2$'.length });
    expect(nextMathRange(md, x)).toEqual({ from: display, to: display + '$$E=mc^2$$'.length });
    expect(nextMathRange(md, display)).toEqual({ from: a, to: a + '$a$'.length });
    expect(nextMathRange(md, a)).toEqual({ from: x, to: x + '$x^2$'.length });
    expect(previousMathRange(md, x)).toEqual({ from: a, to: a + '$a$'.length });
    expect(previousMathRange(md, a)).toEqual({
      from: display,
      to: display + '$$E=mc^2$$'.length,
    });
    expect(nextMathRange('See $ x $ and 12$', 0)).toBeNull();
    expect(previousMathRange('para only', 0)).toBeNull();
  });
});

describe('wrapStrike', () => {
  it('wraps the selection as GFM strikethrough and leaves an empty mark at the cursor', () => {
    expect(wrapStrikePlan('See gone', 4, 8)).toEqual({
      from: 4,
      to: 8,
      text: '~~gone~~',
      cursor: 12,
    });
    expect(wrapStrikePlan('Hello', 5, 5)).toEqual({
      from: 5,
      to: 5,
      text: '~~~~',
      cursor: 7,
    });
    expect(wrapStrikePlan('~~gone~~', 0, 8)).toBeNull();
    expect(wrapStrikePlan('a\nb', 0, 3)).toBeNull();
  });

  it('skips fences', () => {
    const fenced = 'para\n~~~\ngone\n~~~\n';
    expect(wrapStrikePlan(fenced, fenced.indexOf('gone'), fenced.indexOf('gone') + 4)).toBeNull();
  });

  it('unwraps the mark under the cursor and skips tilde runs', () => {
    expect(unwrapStrikePlan('See ~~gone~~', 6, 6)).toEqual({
      from: 4,
      to: 12,
      text: 'gone',
      cursor: 8,
    });
    expect(unwrapStrikePlan('See ~~gone~~', 4, 12)).toEqual({
      from: 4,
      to: 12,
      text: 'gone',
      cursor: 8,
    });
    expect(unwrapStrikePlan('See ~~~gone~~~', 8, 8)).toBeNull();
    expect(unwrapStrikePlan('See gone', 4, 8)).toBeNull();
    const fenced = 'para\n~~~\n~~gone~~\n~~~\n';
    expect(
      unwrapStrikePlan(fenced, fenced.indexOf('~~gone~~') + 2, fenced.indexOf('~~gone~~') + 2)
    ).toBeNull();
  });
});

describe('jumpStrike', () => {
  it('jumps to the next strikethrough and skips fences and tilde runs', () => {
    const md = 'See ~~gone~~ and ~~old~~\n~~~\n~~fake~~\n~~~\nSee ~~~gone~~~ ~~keep~~';
    const gone = md.indexOf('~~gone~~');
    const old = md.indexOf('~~old~~');
    const keep = md.indexOf('~~keep~~');
    expect(nextStrikeRange(md, 0)).toEqual({ from: gone, to: gone + '~~gone~~'.length });
    expect(nextStrikeRange(md, gone)).toEqual({ from: old, to: old + '~~old~~'.length });
    expect(nextStrikeRange(md, old)).toEqual({ from: keep, to: keep + '~~keep~~'.length });
    expect(nextStrikeRange(md, keep)).toEqual({ from: gone, to: gone + '~~gone~~'.length });
    expect(previousStrikeRange(md, gone)).toEqual({ from: keep, to: keep + '~~keep~~'.length });
    expect(previousStrikeRange(md, keep)).toEqual({ from: old, to: old + '~~old~~'.length });
    expect(nextStrikeRange('See ~~~gone~~~', 0)).toBeNull();
    expect(previousStrikeRange('para only', 0)).toBeNull();
  });
});

describe('jumpTask', () => {
  it('jumps to the next open GFM task and skips fences and checked items', () => {
    const md = '- [ ] one\n- [x] done\n* [ ] two\n```\n- [ ] fake\n```\n- [ ] three';
    expect(nextIncompleteTaskRange(md, 0)).toEqual({ from: 2, to: 5 });
    expect(nextIncompleteTaskRange(md, 2)).toEqual({ from: 23, to: 26 });
    expect(nextIncompleteTaskRange(md, 23)).toEqual({ from: 52, to: 55 });
    expect(nextIncompleteTaskRange(md, 52)).toEqual({ from: 2, to: 5 });
    expect(previousIncompleteTaskRange(md, 52)).toEqual({ from: 23, to: 26 });
    expect(previousIncompleteTaskRange(md, 2)).toEqual({ from: 52, to: 55 });
    expect(previousIncompleteTaskRange(md, 10)).toEqual({ from: 2, to: 5 });
    expect(nextIncompleteTaskRange('- [x] done\n- [X] also', 0)).toBeNull();
    expect(previousIncompleteTaskRange('para only', 0)).toBeNull();
    expect(nextIncompleteTaskRange('+ [ ] plus\n1. [ ] numbered', 0)).toEqual({ from: 2, to: 5 });
    expect(nextIncompleteTaskRange('+ [ ] plus\n1. [ ] numbered', 2)).toEqual({ from: 14, to: 17 });
  });

  it('jumps to the next checked GFM task and skips fences and open items', () => {
    const md = '- [ ] open\n- [x] done\n* [X] two\n```\n- [x] fake\n```\n- [x] three';
    const done = md.indexOf('- [x] done') + 2;
    const two = md.indexOf('* [X] two') + 2;
    const three = md.indexOf('- [x] three') + 2;
    expect(nextCompletedTaskRange(md, 0)).toEqual({ from: done, to: done + 3 });
    expect(nextCompletedTaskRange(md, done)).toEqual({ from: two, to: two + 3 });
    expect(nextCompletedTaskRange(md, two)).toEqual({ from: three, to: three + 3 });
    expect(nextCompletedTaskRange(md, three)).toEqual({ from: done, to: done + 3 });
    expect(previousCompletedTaskRange(md, three)).toEqual({ from: two, to: two + 3 });
    expect(previousCompletedTaskRange(md, done)).toEqual({ from: three, to: three + 3 });
    expect(nextCompletedTaskRange('- [ ] open\n* [ ] also', 0)).toBeNull();
    expect(previousCompletedTaskRange('para only', 0)).toBeNull();
  });
});

describe('jumpHeading', () => {
  it('jumps to the next ATX heading and skips fences', () => {
    const md = '# One\n\npara\n```\n# Fake\n```\n## Two';
    expect(nextHeadingRange(md, 0)).toEqual({ from: 27, to: 33 });
    expect(nextHeadingRange(md, 27)).toEqual({ from: 0, to: 5 });
    expect(nextHeadingRange(md, 7)).toEqual({ from: 27, to: 33 });
    expect(previousHeadingRange(md, 27)).toEqual({ from: 0, to: 5 });
    expect(previousHeadingRange(md, 0)).toEqual({ from: 27, to: 33 });
    expect(previousHeadingRange(md, 7)).toEqual({ from: 0, to: 5 });
    expect(nextHeadingRange('para only', 0)).toBeNull();
    expect(previousHeadingRange('para only', 0)).toBeNull();
  });
});

describe('cycleHeading', () => {
  it('cycles ATX marks and unwraps at h6 without rewriting the rest of the note', () => {
    expect(cycleHeadingLine('Hello')).toBe('# Hello');
    expect(cycleHeadingLine('# Hello')).toBe('## Hello');
    expect(cycleHeadingLine('## Hello ##')).toBe('### Hello');
    expect(cycleHeadingLine('###### Hello')).toBe('Hello');
    expect(cycleHeadingLine('> # Hello')).toBe('> ## Hello');
    expect(cycleHeadingLine('')).toBe('# ');
  });

  it('leaves fences, lists, setext, and indented code alone', () => {
    expect(cycleHeadingLine('- item')).toBeNull();
    expect(cycleHeadingLine('```js')).toBeNull();
    expect(cycleHeadingLine('Title', '===')).toBeNull();
    expect(cycleHeadingLine('    # indented')).toBeNull();
    expect(cycleHeadingLine('####### not a heading')).toBeNull();

    const fenced = 'para\n```\n# not a heading\n```\n';
    expect(cycleHeadingAtOffset(fenced, fenced.indexOf('not'))).toBeNull();
    expect(cycleHeadingAtOffset('# Hello\n\nbody', 0)).toEqual({
      from: 0,
      to: 7,
      text: '## Hello',
    });
  });
});

describe('cycleQuote', () => {
  it('nests blockquotes and unwraps at three without rewriting the rest of the note', () => {
    expect(cycleQuoteLine('Hello')).toBe('> Hello');
    expect(cycleQuoteLine('> Hello')).toBe('> > Hello');
    expect(cycleQuoteLine('> > Hello')).toBe('> > > Hello');
    expect(cycleQuoteLine('> > > Hello')).toBe('Hello');
    expect(cycleQuoteLine('# Hello')).toBe('> # Hello');
    expect(cycleQuoteLine('')).toBe('> ');
  });

  it('leaves fences, setext, and indented code alone', () => {
    expect(cycleQuoteLine('```js')).toBeNull();
    expect(cycleQuoteLine('Title', '===')).toBeNull();
    expect(cycleQuoteLine('    indented')).toBeNull();

    const fenced = 'para\n```\n> not a quote\n```\n';
    expect(cycleQuoteAtOffset(fenced, fenced.indexOf('not'))).toBeNull();
    expect(cycleQuoteAtOffset('> Hello\n\nbody', 0)).toEqual({
      from: 0,
      to: 7,
      text: '> > Hello',
    });
  });
});

describe('cycleAlert', () => {
  it('cycles GitHub alert types and unwraps at CAUTION without rewriting the rest of the note', () => {
    expect(cycleAlertLine('Hello')).toBe('> [!NOTE] Hello');
    expect(cycleAlertLine('> [!NOTE] Hello')).toBe('> [!TIP] Hello');
    expect(cycleAlertLine('> [!TIP] Hello')).toBe('> [!IMPORTANT] Hello');
    expect(cycleAlertLine('> [!IMPORTANT] Hello')).toBe('> [!WARNING] Hello');
    expect(cycleAlertLine('> [!WARNING] Hello')).toBe('> [!CAUTION] Hello');
    expect(cycleAlertLine('> [!CAUTION] Hello')).toBe('> Hello');
    expect(cycleAlertLine('> Hello')).toBe('> [!NOTE] Hello');
    expect(cycleAlertLine('> [!caution]')).toBe('> ');
    expect(cycleAlertLine('')).toBe('> [!NOTE]');
  });

  it('leaves fences, setext, and indented code alone', () => {
    expect(cycleAlertLine('```js')).toBeNull();
    expect(cycleAlertLine('Title', '===')).toBeNull();
    expect(cycleAlertLine('    indented')).toBeNull();

    const fenced = 'para\n```\n> [!NOTE] fake\n```\n';
    expect(cycleAlertAtOffset(fenced, fenced.indexOf('NOTE'))).toBeNull();
    expect(cycleAlertAtOffset('> [!NOTE] Hello\n\nbody', 0)).toEqual({
      from: 0,
      to: 15,
      text: '> [!TIP] Hello',
    });
  });
});

describe('cycleList', () => {
  it('cycles bullet, numbered, and task without rewriting the rest of the note', () => {
    expect(cycleListLine('Hello')).toBe('- Hello');
    expect(cycleListLine('- Hello')).toBe('1. Hello');
    expect(cycleListLine('* Hello')).toBe('1. Hello');
    expect(cycleListLine('1. Hello')).toBe('- [ ] Hello');
    expect(cycleListLine('2. Hello')).toBe('- [ ] Hello');
    expect(cycleListLine('- [ ] Hello')).toBe('Hello');
    expect(cycleListLine('- [x] Hello')).toBe('Hello');
    expect(cycleListLine('> Hello')).toBe('> - Hello');
    expect(cycleListLine('> - Hello')).toBe('> 1. Hello');
    expect(cycleListLine('  - nested')).toBe('  1. nested');
    expect(cycleListLine('')).toBe('- ');
  });

  it('leaves headings, fences, setext, tables, and indented code alone', () => {
    expect(cycleListLine('# Hello')).toBeNull();
    expect(cycleListLine('```js')).toBeNull();
    expect(cycleListLine('---')).toBeNull();
    expect(cycleListLine('Title', '===')).toBeNull();
    expect(cycleListLine('| a | b |')).toBeNull();
    expect(cycleListLine('    indented')).toBeNull();

    const fenced = 'para\n```\n- not a list\n```\n';
    expect(cycleListAtOffset(fenced, fenced.indexOf('not'))).toBeNull();
    expect(cycleListAtOffset('- Hello\n\nbody', 0)).toEqual({
      from: 0,
      to: 7,
      text: '1. Hello',
    });
  });
});

describe('csvPreview', () => {
  it('wraps the selection in a csv fence and leaves an empty fence at the cursor', () => {
    expect(csvFencePlan(0, 0, '', 'csv')).toEqual({
      from: 0,
      to: 0,
      text: '```csv\n\n```',
      cursor: 7,
    });
    expect(csvFencePlan(4, 11, 'a,b\n1,2', 'tsv')).toEqual({
      from: 4,
      to: 11,
      text: '```tsv\na,b\n1,2\n```',
      cursor: 14,
    });
  });

  it('splits csv and tsv into rows', () => {
    expect(parseDelimited('a,b\n1,2', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseDelimited('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseDelimited('"last, first",email\n"a,b",x', ',')).toEqual([
      ['last, first', 'email'],
      ['a,b', 'x'],
    ]);
  });
});

describe('dailyNote', () => {
  it('formats YYYY-MM-DD and finds by title', () => {
    expect(dailyNoteTitle(new Date('2026-08-28T12:00:00'))).toBe('2026-08-28');
    expect(dailyNoteBody('2026-08-28')).toBe('# 2026-08-28\n\n');
    expect(findNoteByTitle([{ id: 'n1', title: '2026-08-28' }], '2026-08-28')).toBe('n1');
    expect(findNoteByTitle([], '2026-08-28')).toBeNull();
    expect(dailyNoteTitle(yesterdayDate(new Date(2026, 7, 28, 12)))).toBe('2026-08-27');
    expect(dailyNoteTitle(yesterdayDate(new Date(2026, 7, 1, 12)))).toBe('2026-07-31');
    expect(dailyNoteTitle(tomorrowDate(new Date(2026, 7, 28, 12)))).toBe('2026-08-29');
    expect(dailyNoteTitle(tomorrowDate(new Date(2026, 7, 31, 12)))).toBe('2026-09-01');
  });
});

describe('copyNote', () => {
  it('copies a wikilink from the title and refuses broken marks', () => {
    expect(wikilinkFromTitle(' Ideas ')).toBe('[[Ideas]]');
    expect(wikilinkFromTitle('2026-08-28')).toBe('[[2026-08-28]]');
    expect(wikilinkFromTitle('')).toBeNull();
    expect(wikilinkFromTitle('   ')).toBeNull();
    expect(wikilinkFromTitle('[[oops]]')).toBeNull();
    expect(wikilinkFromTitle('See ]] here')).toBeNull();
  });
});

describe('randomNote / journal / stats / related', () => {
  it('picks from the pool excluding the current note', () => {
    expect(pickRandomId(['a'], 'a')).toBeNull();
    expect(pickRandomId(['a', 'b'], 'a')).toBe('b');
  });

  it('opens the oldest note with no wikilinks', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', updatedAt: '2026-08-01' },
      { id: 'b', notebookId: 'inbox', updatedAt: '2026-07-01' },
      { id: 'c', notebookId: 'templates', updatedAt: '2026-01-01' },
      { id: 'd', notebookId: 'inbox', updatedAt: '2026-06-01' },
    ];
    const edges = [{ source: 'a', target: 'd' }];
    expect(unlinkedNoteId(notes, edges, 'x')).toBe('b');
    expect(unlinkedNoteId(notes, edges, 'b')).toBeNull();
  });

  it('opens the oldest note with no incoming links', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', updatedAt: '2026-08-01' },
      { id: 'b', notebookId: 'inbox', updatedAt: '2026-07-01' },
      { id: 'c', notebookId: 'templates', updatedAt: '2026-01-01' },
      { id: 'd', notebookId: 'inbox', updatedAt: '2026-06-01' },
      { id: 'e', notebookId: 'inbox', updatedAt: '2026-04-01' },
    ];
    const edges = [
      { source: 'a', target: 'd' },
      { source: 'e', target: 'a' },
    ];
    expect(orphanNoteId(notes, edges, 'x')).toBe('e');
    expect(unlinkedNoteId(notes, edges, 'x')).toBe('b');
    expect(orphanNoteId(notes, edges, 'e')).toBe('b');
  });

  it('opens the note with the most incoming links', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', updatedAt: '2026-08-01' },
      { id: 'b', notebookId: 'inbox', updatedAt: '2026-07-01' },
      { id: 'c', notebookId: 'templates', updatedAt: '2026-01-01' },
      { id: 'd', notebookId: 'inbox', updatedAt: '2026-06-01' },
      { id: 'e', notebookId: 'inbox', updatedAt: '2026-04-01' },
    ];
    const edges = [
      { source: 'a', target: 'd' },
      { source: 'e', target: 'd' },
      { source: 'b', target: 'd' },
      { source: 'e', target: 'a' },
      { source: 'b', target: 'c' },
    ];
    expect(hubNoteId(notes, edges, 'x')).toBe('d');
    expect(hubNoteId(notes, edges, 'd')).toBe('a');
    expect(
      hubNoteId(
        notes.filter(n => n.id === 'b' || n.id === 'e'),
        edges,
        'x'
      )
    ).toBeNull();
  });

  it('opens the note with the most outgoing links', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', updatedAt: '2026-08-01' },
      { id: 'b', notebookId: 'inbox', updatedAt: '2026-07-01' },
      { id: 'c', notebookId: 'templates', updatedAt: '2026-01-01' },
      { id: 'd', notebookId: 'inbox', updatedAt: '2026-06-01' },
      { id: 'e', notebookId: 'inbox', updatedAt: '2026-04-01' },
    ];
    const edges = [
      { source: 'a', target: 'd' },
      { source: 'e', target: 'd' },
      { source: 'b', target: 'd' },
      { source: 'e', target: 'a' },
      { source: 'b', target: 'c' },
    ];
    expect(spokeNoteId(notes, edges, 'x')).toBe('e');
    expect(spokeNoteId(notes, edges, 'e')).toBe('b');
    expect(
      spokeNoteId(
        notes.filter(n => n.id === 'd' || n.id === 'c'),
        edges,
        'x'
      )
    ).toBeNull();
  });

  it('opens the oldest note with no tags', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', updatedAt: '2026-08-01', tags: [] },
      { id: 'b', notebookId: 'inbox', updatedAt: '2026-07-01', tags: ['work'] },
      { id: 'c', notebookId: 'templates', updatedAt: '2026-01-01', tags: [] },
      { id: 'd', notebookId: 'inbox', updatedAt: '2026-06-01', tags: [''] },
    ];
    expect(untaggedNoteId(notes, 'x')).toBe('d');
    expect(untaggedNoteId(notes, 'd')).toBe('a');
  });

  it('opens the note with the most unique tags', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', updatedAt: '2026-08-01', tags: ['work'] },
      { id: 'b', notebookId: 'inbox', updatedAt: '2026-07-01', tags: ['work', 'home', 'idea'] },
      { id: 'c', notebookId: 'templates', updatedAt: '2026-01-01', tags: ['a', 'b', 'c', 'd'] },
      { id: 'd', notebookId: 'inbox', updatedAt: '2026-06-01', tags: [] },
      { id: 'e', notebookId: 'inbox', updatedAt: '2026-05-01', tags: ['Work', 'work', ''] },
      { id: 'f', notebookId: 'inbox', updatedAt: '2026-03-01', tags: ['x', 'y'] },
    ];
    expect(mostTaggedNoteId(notes, 'x')).toBe('b');
    expect(mostTaggedNoteId(notes, 'b')).toBe('f');
    expect(
      mostTaggedNoteId(
        notes.filter(n => n.id === 'c' || n.id === 'd'),
        'x'
      )
    ).toBeNull();
  });

  it('opens the oldest thin note and skips daily titles', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', title: 'Long', updatedAt: '2026-08-01', wordCount: 80 },
      { id: 'b', notebookId: 'inbox', title: 'Idea', updatedAt: '2026-07-01', wordCount: 3 },
      { id: 'c', notebookId: 'templates', title: 'Tpl', updatedAt: '2026-01-01', wordCount: 1 },
      { id: 'd', notebookId: 'inbox', title: '2026-08-28', updatedAt: '2026-04-01', wordCount: 1 },
      { id: 'e', notebookId: 'inbox', title: 'Scratch', updatedAt: '2026-05-01', wordCount: 0 },
    ];
    expect(stubNoteId(notes, 'x')).toBe('e');
    expect(stubNoteId(notes, 'e')).toBe('b');
  });

  it('opens the note with the most words and skips daily titles', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', title: 'Long', updatedAt: '2026-08-01', wordCount: 80 },
      { id: 'b', notebookId: 'inbox', title: 'Essay', updatedAt: '2026-07-01', wordCount: 80 },
      { id: 'c', notebookId: 'templates', title: 'Tpl', updatedAt: '2026-01-01', wordCount: 400 },
      {
        id: 'd',
        notebookId: 'inbox',
        title: '2026-08-28',
        updatedAt: '2026-04-01',
        wordCount: 200,
      },
      { id: 'e', notebookId: 'inbox', title: 'Scratch', updatedAt: '2026-05-01', wordCount: 0 },
    ];
    expect(longestNoteId(notes, 'x')).toBe('b');
    expect(longestNoteId(notes, 'b')).toBe('a');
    expect(
      longestNoteId(
        notes.filter(n => n.id === 'c' || n.id === 'd' || n.id === 'e'),
        'x'
      )
    ).toBeNull();
  });

  it('opens the least-recently edited note and skips daily titles', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', title: 'Long', updatedAt: '2026-08-01' },
      { id: 'b', notebookId: 'inbox', title: 'Essay', updatedAt: '2026-03-01' },
      { id: 'c', notebookId: 'templates', title: 'Tpl', updatedAt: '2026-01-01' },
      { id: 'd', notebookId: 'inbox', title: '2026-08-28', updatedAt: '2026-02-01' },
      { id: 'e', notebookId: 'inbox', title: 'Scratch', updatedAt: '2026-05-01' },
    ];
    expect(staleNoteId(notes, 'x')).toBe('b');
    expect(staleNoteId(notes, 'b')).toBe('e');
    expect(
      staleNoteId(
        notes.filter(n => n.id === 'c' || n.id === 'd'),
        'x'
      )
    ).toBeNull();
  });

  it('opens the most-recently edited note and skips daily titles', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', title: 'Long', updatedAt: '2026-08-01' },
      { id: 'b', notebookId: 'inbox', title: 'Essay', updatedAt: '2026-03-01' },
      { id: 'c', notebookId: 'templates', title: 'Tpl', updatedAt: '2026-09-01' },
      { id: 'd', notebookId: 'inbox', title: '2026-08-28', updatedAt: '2026-08-28' },
      { id: 'e', notebookId: 'inbox', title: 'Scratch', updatedAt: '2026-05-01' },
    ];
    expect(newestNoteId(notes, 'x')).toBe('a');
    expect(newestNoteId(notes, 'a')).toBe('e');
    expect(
      newestNoteId(
        notes.filter(n => n.id === 'c' || n.id === 'd'),
        'x'
      )
    ).toBeNull();
  });

  it('opens the oldest note whose title is used more than once', () => {
    const notes = [
      { id: 'a', notebookId: 'inbox', title: 'Ideas', updatedAt: '2026-08-01' },
      { id: 'b', notebookId: 'inbox', title: 'ideas', updatedAt: '2026-07-01' },
      { id: 'c', notebookId: 'templates', title: 'Ideas', updatedAt: '2026-01-01' },
      { id: 'd', notebookId: 'inbox', title: 'Unique', updatedAt: '2026-04-01' },
    ];
    expect(duplicateTitleId(notes, 'x')).toBe('b');
    expect(duplicateTitleId(notes, 'b')).toBe('a');
    expect(
      duplicateTitleId(
        notes.filter(n => n.id !== 'a'),
        'x'
      )
    ).toBeNull();
  });

  it('stamps a time heading', () => {
    expect(journalStamp(new Date('2026-08-28T09:05:00'))).toBe('\n\n## 09:05\n\n');
  });

  it('hides task stats when the note has none', () => {
    expect(taskStatsLabel(0, 0)).toBeNull();
    expect(taskStatsLabel(2, 5)).toBe('2/5 tasks');
  });

  it('ranks notes that share tags', () => {
    const related = relatedBySharedTags(
      'n1',
      ['work'],
      [
        { id: 'n1', title: 'Self', tags: ['work'] },
        { id: 'n2', title: 'Other', tags: ['Work'] },
        { id: 'n3', title: 'Skip', tags: ['home'] },
      ]
    );
    expect(related).toEqual([{ id: 'n2', title: 'Other' }]);
  });
});

describe('palette library', () => {
  it('ships at least 16 unique palettes outside retired bundled ids', () => {
    expect(PALETTE_LIBRARY.length).toBeGreaterThanOrEqual(16);
    const ids = PALETTE_LIBRARY.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect((RETIRED_BUNDLED_THEME_IDS as readonly string[]).includes(id)).toBe(false);
      expect(id.startsWith('dripnex-')).toBe(true);
    }
    expect(PALETTE_LIBRARY.every(t => t.tokens['--accent'] && t.tokens['--bg-base'])).toBe(true);
  });
});
