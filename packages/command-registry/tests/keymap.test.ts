import { describe, expect, it } from 'vitest';
import { parseChord, parseKeymap } from '../src/keymap';

describe('parseChord', () => {
  it('parses Mod+Shift+K', () => {
    expect(parseChord('Mod+Shift+K')).toEqual({
      key: 'k',
      modifiers: ['Mod', 'Shift'],
    });
  });

  it('treats Cmd and Ctrl as Mod', () => {
    expect(parseChord('Cmd+N')).toEqual({ key: 'n', modifiers: ['Mod'] });
    expect(parseChord('Ctrl+N')).toEqual({ key: 'n', modifiers: ['Mod'] });
  });

  it('returns null for garbage', () => {
    expect(parseChord('')).toBeNull();
    expect(parseChord('Super+N')).toBeNull();
  });
});

describe('parseKeymap', () => {
  it('parses command → chord and null unbinds', () => {
    const { overrides, errors } = parseKeymap(`
      {
        "app:new-note": "Mod+Shift+N",
        "app:toggle-graph": null
      }
    `);
    expect(errors).toEqual([]);
    expect(overrides).toEqual([
      { commandId: 'app:new-note', keybinding: { key: 'n', modifiers: ['Mod', 'Shift'] } },
      { commandId: 'app:toggle-graph', keybinding: null },
    ]);
  });

  it('allows // comments and _comment keys', () => {
    const { overrides, errors } = parseKeymap(`
      // remap graph
      {
        "_comment": "ignored",
        "app:toggle-graph": "Mod+Shift+G"
      }
    `);
    expect(errors).toEqual([]);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.commandId).toBe('app:toggle-graph');
  });

  it('reports invalid JSON and bad chords', () => {
    expect(parseKeymap('{').errors[0]).toMatch(/Invalid JSON/);
    expect(parseKeymap('{ "app:new-note": "Nope+N" }').errors[0]).toMatch(/invalid chord/);
  });
});
