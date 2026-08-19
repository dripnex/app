import { describe, it, expect } from 'vitest';
import { buildNesPrompt, extractNesInsertion, nesLineContext } from '../parse';

describe('nesLineContext', () => {
  it('splits the cursor line and windows surrounding text', () => {
    const content = 'alpha\nHello |\nomega';
    const cursor = content.indexOf('|');
    const doc = content.slice(0, cursor) + content.slice(cursor + 1);
    const ctx = nesLineContext(doc, cursor, 'Note');
    expect(ctx).toEqual({
      prefix: 'Hello ',
      suffix: '',
      before: 'alpha\n',
      after: '\nomega',
      title: 'Note',
    });
  });
});

describe('buildNesPrompt', () => {
  it('marks the cursor on the editable line', () => {
    const prompt = buildNesPrompt({
      prefix: '- [ ] ',
      suffix: '',
      before: '# Tasks\n',
      after: '',
      title: 'Ship',
    });
    expect(prompt).toContain('TITLE: Ship');
    expect(prompt).toContain('- [ ] ⟦CURSOR⟧');
    expect(prompt).toContain('# Tasks');
  });
});

describe('extractNesInsertion', () => {
  it('strips a reproduced prefix and suffix', () => {
    expect(extractNesInsertion('Hello world!', 'Hello ', '!')).toBe('world');
  });

  it('accepts a bare continuation when the prefix is empty', () => {
    expect(extractNesInsertion('next item', '', '')).toBe('next item');
  });

  it('rejects output that does not reproduce the prefix', () => {
    expect(extractNesInsertion('The capital of France', 'Hello ', '')).toBeNull();
  });

  it('skips a fenced block wrapper', () => {
    expect(extractNesInsertion('```\nHello world\n```', 'Hello ', '')).toBe('world');
  });

  it('rejects empty insertions', () => {
    expect(extractNesInsertion('Hello ', 'Hello ', '')).toBeNull();
  });
});
