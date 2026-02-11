import { describe, it, expect, vi } from 'vitest';
import { createAppAPI } from '../src/app/createAppAPI';
import type { AppAPIBridge } from '../src/app/createAppAPI';

function makeBridge(overrides: Partial<AppAPIBridge> = {}): AppAPIBridge {
  return {
    getCurrentNote: () => null,
    searchNotes: async () => [],
    getNoteById: async () => null,
    getNoteTags: async () => [],
    getBacklinks: async () => [],
    ...overrides,
  };
}

describe('createAppAPI', () => {
  describe('delegation', () => {
    it('delegates getCurrentNote to bridge', () => {
      const note = { id: '1', title: 'Test', content: 'body' };
      const api = createAppAPI(makeBridge({ getCurrentNote: () => note }));
      expect(api.getCurrentNote()).toBe(note);
    });

    it('delegates searchNotes to bridge', async () => {
      const results = [{ id: '1', title: 'Match' }];
      const api = createAppAPI(makeBridge({ searchNotes: async () => results }));
      expect(await api.searchNotes('match')).toBe(results);
    });

    it('delegates getNoteById to bridge', async () => {
      const note = { id: '1', title: 'Test', content: 'body' };
      const api = createAppAPI(makeBridge({ getNoteById: async () => note }));
      expect(await api.getNoteById('1')).toBe(note);
    });
  });

  describe('events', () => {
    it('onNoteSelected fires when notified', () => {
      const api = createAppAPI(makeBridge());
      const cb = vi.fn();
      api.onNoteSelected(cb);

      const note = { id: '1', title: 'Test', content: 'body' };
      api._notifyNoteSelected(note);

      expect(cb).toHaveBeenCalledWith(note);
    });

    it('onNoteCreated fires when notified', () => {
      const api = createAppAPI(makeBridge());
      const cb = vi.fn();
      api.onNoteCreated(cb);

      const note = { id: '2', title: 'New', content: '' };
      api._notifyNoteCreated(note);

      expect(cb).toHaveBeenCalledWith(note);
    });

    it('onNoteDeleted fires when notified', () => {
      const api = createAppAPI(makeBridge());
      const cb = vi.fn();
      api.onNoteDeleted(cb);

      api._notifyNoteDeleted('abc');
      expect(cb).toHaveBeenCalledWith('abc');
    });

    it('unsubscribe removes listener', () => {
      const api = createAppAPI(makeBridge());
      const cb = vi.fn();
      const unsub = api.onNoteSelected(cb);

      unsub();
      api._notifyNoteSelected(null);

      expect(cb).not.toHaveBeenCalled();
    });

    it('multiple listeners all fire', () => {
      const api = createAppAPI(makeBridge());
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      api.onNoteSelected(cb1);
      api.onNoteSelected(cb2);

      api._notifyNoteSelected(null);

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it('unsubscribing one listener does not affect others', () => {
      const api = createAppAPI(makeBridge());
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = api.onNoteSelected(cb1);
      api.onNoteSelected(cb2);

      unsub1();
      api._notifyNoteSelected(null);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });
});
