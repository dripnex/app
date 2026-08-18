import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { neighborId } from '../../utils/neighborId';
import { formatRelativeLineNumber } from '../vim/relativeLineNumbers';
import { vimModeLabel } from '../vim/modeLabel';
import { VIM_EX_COMMANDS } from '../vim/exCommands';

describe('neighborId', () => {
  const ids = ['a', 'b', 'c'];

  it('moves forward and backward', () => {
    expect(neighborId(ids, 'b', 1)).toBe('c');
    expect(neighborId(ids, 'b', -1)).toBe('a');
  });

  it('stops at the ends', () => {
    expect(neighborId(ids, 'c', 1)).toBeNull();
    expect(neighborId(ids, 'a', -1)).toBeNull();
  });

  it('picks an end when nothing is selected', () => {
    expect(neighborId(ids, null, 1)).toBe('a');
    expect(neighborId(ids, null, -1)).toBe('c');
  });

  it('returns null for an empty list', () => {
    expect(neighborId([], 'a', 1)).toBeNull();
  });
});

describe('formatRelativeLineNumber', () => {
  it('shows absolute on the cursor line and distance elsewhere', () => {
    const state = EditorState.create({ doc: 'one\ntwo\nthree\nfour' });
    const atLine2 = state.update({
      selection: { anchor: state.doc.line(2).from },
    }).state;
    expect(formatRelativeLineNumber(2, atLine2)).toBe('2');
    expect(formatRelativeLineNumber(1, atLine2)).toBe('1');
    expect(formatRelativeLineNumber(4, atLine2)).toBe('2');
  });
});

describe('vimModeLabel', () => {
  it('maps vim state bits to status labels', () => {
    expect(vimModeLabel(undefined)).toBe('NORMAL');
    expect(vimModeLabel({ insertMode: true })).toBe('INSERT');
    expect(vimModeLabel({ insertMode: true, mode: 'replace' })).toBe('REPLACE');
    expect(vimModeLabel({ visualMode: true })).toBe('VISUAL');
    expect(vimModeLabel({ visualMode: true, visualLine: true })).toBe('V-LINE');
    expect(vimModeLabel({ visualMode: true, visualBlock: true })).toBe('V-BLOCK');
    expect(vimModeLabel({ exMode: true })).toBe('COMMAND');
  });
});

describe('VIM_EX_COMMANDS', () => {
  it('wires Inkdrop-compatible Ex names to app commands', () => {
    const byName = Object.fromEntries(VIM_EX_COMMANDS.map(c => [c.name, c.command]));
    expect(byName.write).toBe('app:save-note');
    expect(byName.next).toBe('app:next-note');
    expect(byName.prev).toBe('app:prev-note');
    expect(byName.preview).toBe('app:toggle-preview');
    expect(byName['side-by-side']).toBe('app:toggle-split');
  });
});
