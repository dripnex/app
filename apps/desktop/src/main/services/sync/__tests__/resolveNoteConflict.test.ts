import { describe, expect, it } from 'vitest';
import { chosenConflictContent, needsLocalRestore } from '../resolveNoteConflict';

const versions = {
  localContent: '# Meeting\n\nLocal',
  remoteContent: '# Meeting\n\nRemote',
};

describe('chosenConflictContent', () => {
  it('returns the local body when keeping this device', () => {
    expect(chosenConflictContent('local', versions)).toBe(versions.localContent);
  });

  it('returns the remote body when keeping the other device', () => {
    expect(chosenConflictContent('remote', versions)).toBe(versions.remoteContent);
  });
});

describe('needsLocalRestore', () => {
  it('is true after pull overwrote the note with remote', () => {
    expect(needsLocalRestore(versions.remoteContent, versions.localContent)).toBe(true);
  });

  it('is false when the note still has the local body', () => {
    expect(needsLocalRestore(versions.localContent, versions.localContent)).toBe(false);
  });
});
