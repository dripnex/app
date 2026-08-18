import { useEffect, useRef } from 'react';
import { useEditorBufferStore } from '../stores/editorBufferStore';

/**
 * Flushes pending editor saves before the window closes.
 *
 * @param handleUpdateNote - The current note-update handler. A ref is used
 *   internally so the latest version is always called from `beforeunload`.
 */
export function useAutoSave(handleUpdateNote: (content: string) => Promise<void>) {
  const handleUpdateNoteRef = useRef(handleUpdateNote);
  handleUpdateNoteRef.current = handleUpdateNote;

  useEffect(() => {
    const flush = () => {
      const bufferState = useEditorBufferStore.getState();
      if (bufferState.isDirty && bufferState.noteId) {
        void handleUpdateNoteRef.current(bufferState.liveContent);
      }
    };

    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('dripnex:save-note', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('dripnex:save-note', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);
}
