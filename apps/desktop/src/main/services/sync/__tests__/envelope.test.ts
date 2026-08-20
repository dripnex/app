import { describe, expect, it } from 'vitest';
import { parseSyncedNote, serializeSyncedNote } from '../envelope.js';

describe('synced note envelope', () => {
  it('round-trips metadata with the markdown body', () => {
    const encoded = serializeSyncedNote({
      content: '# Hello\n\nbody',
      notebookId: 'work',
      isPinned: true,
      isDeleted: false,
      status: 'on_hold',
      tags: ['ship', 'review'],
    });
    expect(parseSyncedNote(encoded)).toEqual({
      content: '# Hello\n\nbody',
      notebookId: 'work',
      isPinned: true,
      isDeleted: false,
      status: 'on_hold',
      tags: ['ship', 'review'],
    });
  });

  it('treats legacy ciphertext as markdown in Inbox', () => {
    expect(parseSyncedNote('# Old note\n\nplain')).toEqual({
      content: '# Old note\n\nplain',
      notebookId: 'inbox',
      isPinned: false,
      isDeleted: false,
      status: 'active',
      tags: [],
    });
  });

  it('does not treat a JSON note body as an envelope', () => {
    const jsonNote = '{"v":1,"content":"nope"}';
    expect(parseSyncedNote(jsonNote).content).toBe(jsonNote);
    expect(parseSyncedNote(jsonNote).notebookId).toBe('inbox');
  });
});
