import type { AppAPI, NoteInfo } from '../types';

/** Extended AppAPI with internal notify methods (called by host, not plugins) */
export interface AppAPIWithEvents extends AppAPI {
  _notifyNoteSelected(note: NoteInfo | null): void;
  _notifyNoteCreated(note: NoteInfo): void;
  _notifyNoteDeleted(noteId: string): void;
}

/** Bridge injected by the host to provide data access */
export interface AppAPIBridge {
  getCurrentNote(): NoteInfo | null;
  searchNotes(query: string): Promise<Array<{ id: string; title: string }>>;
  getNoteById(id: string): Promise<NoteInfo | null>;
  getNoteTags(noteId: string): Promise<string[]>;
  getBacklinks(noteId: string): Promise<Array<{ noteId: string; noteTitle: string }>>;
}

/**
 * Create an AppAPI from a bridge object.
 * The bridge provides data access; the returned object adds event subscriptions
 * and internal _notify* methods for the host to fire.
 */
export function createAppAPI(bridge: AppAPIBridge): AppAPIWithEvents {
  const noteSelectedListeners = new Set<(note: NoteInfo | null) => void>();
  const noteCreatedListeners = new Set<(note: NoteInfo) => void>();
  const noteDeletedListeners = new Set<(noteId: string) => void>();

  return {
    // Delegate to bridge
    getCurrentNote: () => bridge.getCurrentNote(),
    searchNotes: query => bridge.searchNotes(query),
    getNoteById: id => bridge.getNoteById(id),
    getNoteTags: noteId => bridge.getNoteTags(noteId),
    getBacklinks: noteId => bridge.getBacklinks(noteId),

    // Event subscriptions (return unsubscribe fn)
    onNoteSelected(cb) {
      noteSelectedListeners.add(cb);
      return () => {
        noteSelectedListeners.delete(cb);
      };
    },
    onNoteCreated(cb) {
      noteCreatedListeners.add(cb);
      return () => {
        noteCreatedListeners.delete(cb);
      };
    },
    onNoteDeleted(cb) {
      noteDeletedListeners.add(cb);
      return () => {
        noteDeletedListeners.delete(cb);
      };
    },

    // Internal notify methods (called by host)
    _notifyNoteSelected(note) {
      for (const cb of noteSelectedListeners) cb(note);
    },
    _notifyNoteCreated(note) {
      for (const cb of noteCreatedListeners) cb(note);
    },
    _notifyNoteDeleted(noteId) {
      for (const cb of noteDeletedListeners) cb(noteId);
    },
  };
}
