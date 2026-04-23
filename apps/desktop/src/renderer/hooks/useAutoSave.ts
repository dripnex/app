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
    const handleBeforeUnload = () => {
      const bufferState = useEditorBufferStore.getState();
      if (bufferState.isDirty && bufferState.noteId) {
        // Fire the save — can't await in beforeunload, but the IPC call
        // will be queued before the renderer is torn down
        void handleUpdateNoteRef.current(bufferState.liveContent);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
