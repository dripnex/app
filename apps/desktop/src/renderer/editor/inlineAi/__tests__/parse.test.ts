import { describe, it, expect } from 'vitest';
import { buildInlineEditPrompt, extractInlineReplacement, inlineEditContext } from '../parse';

describe('inlineEditContext', () => {
  it('windows text around the selection', () => {
    const content = 'aaa\nHello world\nzzz';
    const from = content.indexOf('Hello');
    const to = from + 'Hello'.length;
    const ctx = inlineEditContext(content, from, to, 'Note', 'Proofread');
    expect(ctx.selection).toBe('Hello');
    expect(ctx.before).toBe('aaa\n');
    expect(ctx.after).toBe(' world\nzzz');
    expect(ctx.title).toBe('Note');
  });
});

describe('buildInlineEditPrompt', () => {
  it('includes the instruction and selection', () => {
    const prompt = buildInlineEditPrompt({
      title: 'Ship',
      selection: 'teh list',
      before: '',
      after: '',
      instruction: 'Proofread',
    });
    expect(prompt).toContain('TITLE: Ship');
    expect(prompt).toContain('teh list');
    expect(prompt).toContain('INSTRUCTION: Proofread');
  });
});

describe('extractInlineReplacement', () => {
  it('returns plain text', () => {
    expect(extractInlineReplacement('Hello world', false)).toBe('Hello world');
  });

  it('unwraps a single markdown fence', () => {
    expect(extractInlineReplacement('```markdown\nHello\n```', false)).toBe('Hello\n');
  });

  it('keeps a fence when asked', () => {
    expect(extractInlineReplacement('```mermaid\ngraph TD\n```', true)).toBe(
      '```mermaid\ngraph TD\n```'
    );
  });

  it('preserves indented list items', () => {
    expect(extractInlineReplacement('  - child', false)).toBe('  - child');
  });

  it('preserves indented code inside a wrapping fence', () => {
    expect(extractInlineReplacement('```\n    code\n```', false)).toBe('    code\n');
  });

  it('rejects empty output', () => {
    expect(extractInlineReplacement('   ', false)).toBeNull();
  });
});
