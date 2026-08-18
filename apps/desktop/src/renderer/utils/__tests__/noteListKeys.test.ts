import { describe, expect, it } from 'vitest';
import { noteListNavDirection } from '../noteListKeys';

function event(key: string, target: unknown = { tagName: 'DIV' }) {
  return { key, target };
}

describe('noteListNavDirection', () => {
  it('maps j/k and arrows', () => {
    expect(noteListNavDirection(event('j'))).toBe(1);
    expect(noteListNavDirection(event('ArrowDown'))).toBe(1);
    expect(noteListNavDirection(event('k'))).toBe(-1);
    expect(noteListNavDirection(event('ArrowUp'))).toBe(-1);
  });

  it('ignores modifiers and other keys', () => {
    expect(noteListNavDirection({ key: 'j', metaKey: true, target: { tagName: 'DIV' } })).toBeNull();
    expect(noteListNavDirection(event('l'))).toBeNull();
  });

  it('ignores typing surfaces and the editor', () => {
    expect(noteListNavDirection(event('j', { tagName: 'INPUT' }))).toBeNull();
    const editor = {
      tagName: 'DIV',
      closest: (sel: string) => (sel === '.cm-editor' ? {} : null),
    };
    expect(noteListNavDirection(event('j', editor))).toBeNull();
  });
});
