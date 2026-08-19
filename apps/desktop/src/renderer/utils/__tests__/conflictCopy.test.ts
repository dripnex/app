import { describe, expect, it } from 'vitest';
import {
  conflictNoteTitle,
  conflictQueueLabel,
  hasNewConflict,
  mergeConflicts,
  remoteCopyTitle,
} from '../conflictCopy';

describe('conflictNoteTitle', () => {
  it('uses the first heading', () => {
    expect(conflictNoteTitle('# Meeting notes\n\nBody')).toBe('Meeting notes');
  });

  it('falls back to Untitled', () => {
    expect(conflictNoteTitle('   \n')).toBe('Untitled');
  });
});

describe('remoteCopyTitle', () => {
  it('appends (remote)', () => {
    expect(remoteCopyTitle('Meeting notes')).toBe('Meeting notes (remote)');
  });

  it('does not double the suffix', () => {
    expect(remoteCopyTitle('Meeting notes (remote)')).toBe('Meeting notes (remote)');
  });

  it('uses Untitled when empty', () => {
    expect(remoteCopyTitle('  ')).toBe('Untitled (remote)');
  });
});

describe('conflictQueueLabel', () => {
  it('singular for one', () => {
    expect(conflictQueueLabel(0, 1)).toBe('1 conflict');
  });

  it('numbers a queue', () => {
    expect(conflictQueueLabel(1, 3)).toBe('Conflict 2 of 3');
  });
});

describe('mergeConflicts', () => {
  it('keeps unresolved when incoming is empty', () => {
    const existing = [{ noteId: 'a' }];
    expect(mergeConflicts(existing, [])).toBe(existing);
  });

  it('adds new ids and replaces the same id', () => {
    const existing = [{ noteId: 'a', localContent: 'old' }];
    const next = mergeConflicts(existing, [
      { noteId: 'a', localContent: 'new' },
      { noteId: 'b', localContent: 'other' },
    ]);
    expect(next).toEqual([
      { noteId: 'a', localContent: 'new' },
      { noteId: 'b', localContent: 'other' },
    ]);
  });
});

describe('hasNewConflict', () => {
  it('is true only for unseen note ids', () => {
    expect(hasNewConflict([{ noteId: 'a' }], [{ noteId: 'a' }])).toBe(false);
    expect(hasNewConflict([{ noteId: 'a' }], [{ noteId: 'b' }])).toBe(true);
  });
});
