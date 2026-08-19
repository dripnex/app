import { describe, expect, it, vi } from 'vitest';
import { openBothConflict } from '../openBothConflict';
import type { Conflict } from '../../stores/syncStore';

const conflict: Conflict = {
  noteId: 'note-1',
  localContent: '# Meeting\n\nLocal edits',
  remoteContent: '# Meeting\n\nRemote edits',
  localVersion: 3,
  remoteVersion: 4,
  timestamp: '2026-08-19T12:00:00.000Z',
};

function deps(overrides: Partial<Parameters<typeof openBothConflict>[1]> = {}) {
  return {
    getNote: vi.fn(async () => ({ ok: true as const, data: { id: 'note-1', notebookId: 'work' } })),
    createNote: vi.fn(async () => ({ ok: true as const, data: { id: 'note-remote' } })),
    updateTitle: vi.fn(async () => ({ ok: true })),
    openNote: vi.fn(async () => ({ ok: true })),
    resolveLocal: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('openBothConflict', () => {
  it('saves the other version, keeps this device, opens both', async () => {
    const api = deps();
    const result = await openBothConflict(conflict, api);

    expect(result).toEqual({ remoteNoteId: 'note-remote', remoteTitle: 'Meeting (remote)' });
    expect(api.createNote).toHaveBeenCalledWith({
      content: conflict.remoteContent,
      notebookId: 'work',
    });
    expect(api.updateTitle).toHaveBeenCalledWith({
      id: 'note-remote',
      title: 'Meeting (remote)',
    });
    expect(api.resolveLocal).toHaveBeenCalledWith('note-1');
    expect(api.openNote).toHaveBeenNthCalledWith(1, 'note-1', 'Meeting');
    expect(api.openNote).toHaveBeenNthCalledWith(2, 'note-remote', 'Meeting (remote)');
  });

  it('does not resolve when the copy cannot be created', async () => {
    const api = deps({
      createNote: vi.fn(async () => ({ ok: false as const })),
    });

    await expect(openBothConflict(conflict, api)).rejects.toThrow(
      'Could not save the other version as a new note.'
    );
    expect(api.resolveLocal).not.toHaveBeenCalled();
    expect(api.openNote).not.toHaveBeenCalled();
  });
});
