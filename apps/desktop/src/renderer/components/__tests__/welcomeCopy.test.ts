import { describe, expect, it } from 'vitest';
import { WELCOME_FEATURES, WELCOME_HEADLINE, WELCOME_LEDE } from '../Welcome';

const KILLED = [
  'Standard .md under the hood',
  'No account to open a file',
  'Your notes remain files',
  'Markdown-first, offline-forever',
  'careful software',
  'ship less',
  'Your Markdown. Your Machine',
];

describe('welcome copy',
 () => {
  const blob = [WELCOME_HEADLINE, WELCOME_LEDE, ...WELCOME_FEATURES.flatMap(f => [f.title, f.desc])].join('\n');

  it('states the hackable AI note taker identity',
 () => {
    expect(WELCOME_HEADLINE).toBe('The hackable AI note taker');
    expect(WELCOME_LEDE.toLowerCase()).toContain('messy input');
    expect(blob).toMatch(/SQLite/);
    expect(blob).toMatch(/init\.js/);
    expect(blob).toMatch(/AuthGate/);
  });

  it('does not use killed files-first manifesto lines',
 () => {
    for (const line of KILLED) {
      expect(blob, line).not.toContain(line);
    }
  });
});
