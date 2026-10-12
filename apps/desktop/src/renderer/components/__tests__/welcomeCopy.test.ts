import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  WELCOME_CREATE,
  WELCOME_FEATURES,
  WELCOME_HEADLINE,
  WELCOME_LEDE,
  WELCOME_SKIP,
  welcomeHint,
} from '../welcomeCopy';

const here = dirname(fileURLToPath(import.meta.url));
const welcomeSrc = readFileSync(join(here, '../Welcome.tsx'), 'utf8');
const welcomeCss = readFileSync(join(here, '../Welcome.module.css'), 'utf8');

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

  it('keeps the CTA dry and uses a real accelerator', () => {
    expect(WELCOME_CREATE.toLowerCase()).not.toMatch(/first/);
    expect(WELCOME_SKIP).toBe('Skip');
    expect(welcomeHint()).toMatch(/⌘K|Ctrl\+K/);
    expect(welcomeHint().toLowerCase()).not.toContain('pro tip');
  });

  it('plays GSAP welcome-in instead of a 400ms CSS stagger', () => {
    expect(welcomeSrc).toContain("playMotion('welcome-in'");
    expect(welcomeCss).not.toMatch(/@keyframes fade-in/);
    expect(welcomeCss).not.toMatch(/animation:\s*fade-in 400ms/);
  });
});
