import { describe, expect, it } from 'vitest';
import { WELCOME_FEATURES, WELCOME_HEADLINE, WELCOME_LEDE } from '../welcomeCopy';

/** Split so a repo grep of the dead slogans stays clean. */
const KILLED = [
  ['Standard', '.md under the hood'].join(' '),
  ['No account to', 'open a file'].join(' '),
  ['Your notes remain', 'files'].join(' '),
  ['Markdown', '-first, ', 'offline', '-forever'].join(''),
  ['careful', 'software'].join(' '),
  ['ship', 'less'].join(' '),
  ['Your Markdown.', 'Your Machine'].join(' '),
];

describe('welcome copy', () => {
  const blob = [
    WELCOME_HEADLINE,
    WELCOME_LEDE,
    ...WELCOME_FEATURES.flatMap(f => [f.title, f.desc]),
  ].join('\n');

  it('states the hackable AI note taker identity', () => {
    expect(WELCOME_HEADLINE).toBe('The hackable AI note taker');
    expect(WELCOME_LEDE.toLowerCase()).toContain('messy input');
    expect(blob).toMatch(/SQLite/);
    expect(blob).toMatch(/init\.js/);
    expect(blob).toMatch(/AuthGate/);
  });

  it('does not use killed files-first manifesto lines', () => {
    for (const line of KILLED) {
      expect(blob.includes(line), line).toBe(false);
    }
  });
});
