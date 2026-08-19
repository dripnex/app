import { describe, expect, it } from 'vitest';
import { resolveWikilinkClick } from '../resolveWikilinkClick';

const current = { id: 'n1', title: 'Home' };

describe('resolveWikilinkClick', () => {
  it('jumps on the current note for [[#heading]]', () => {
    expect(resolveWikilinkClick({ title: '', heading: 'Setup', currentNote: current })).toEqual({
      kind: 'heading',
      noteId: 'n1',
      heading: 'Setup',
    });
    expect(resolveWikilinkClick({ title: 'Home', heading: 'Setup', currentNote: current })).toEqual(
      { kind: 'heading', noteId: 'n1', heading: 'Setup' }
    );
  });

  it('opens an existing target', () => {
    expect(
      resolveWikilinkClick({
        title: 'Other',
        heading: 'Setup',
        currentNote: current,
        match: { id: 'n2' },
      })
    ).toEqual({ kind: 'open', noteId: 'n2', heading: 'Setup' });
    expect(resolveWikilinkClick({ title: 'Other', match: { id: 'n2' } })).toEqual({
      kind: 'open',
      noteId: 'n2',
    });
  });

  it('creates a missing target', () => {
    expect(resolveWikilinkClick({ title: 'New note', currentNote: current })).toEqual({
      kind: 'create',
      title: 'New note',
    });
  });

  it('ignores empty targets without a heading', () => {
    expect(resolveWikilinkClick({ title: '   ' })).toEqual({ kind: 'ignore' });
  });
});
