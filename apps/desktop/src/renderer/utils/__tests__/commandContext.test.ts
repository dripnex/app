import { describe, expect, it } from 'vitest';
import { resolveCommandContext } from '../commandContext';

function el(closestMatch?: string, tagName = 'DIV') {
  return {
    tagName,
    closest: (sel: string) => (sel === closestMatch ? {} : null),
  };
}

describe('resolveCommandContext', () => {
  it('is editor inside CodeMirror', () => {
    expect(resolveCommandContext(el('.cm-editor'), { querySelector: () => ({}) })).toBe('editor');
  });

  it('is app in a form, dialog, or preview even if the note list exists', () => {
    const list = { querySelector: (sel: string) => (sel === '[data-note-list]' ? {} : null) };
    expect(resolveCommandContext({ tagName: 'INPUT' }, list)).toBe('app');
    expect(resolveCommandContext(el('[data-preview]'), list)).toBe('app');
    expect(resolveCommandContext(el('[role="dialog"]'), list)).toBe('app');
  });

  it('is note-list when the list is mounted and the editor is not focused', () => {
    expect(
      resolveCommandContext(el(), {
        querySelector: (sel: string) => (sel === '[data-note-list]' ? {} : null),
      })
    ).toBe('note-list');
  });

  it('is app when there is no note list', () => {
    expect(resolveCommandContext(el(), { querySelector: () => null })).toBe('app');
  });
});
