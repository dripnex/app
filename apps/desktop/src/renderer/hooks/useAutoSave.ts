import { useEffect, useRef } from 'react';
import { useEditorBufferStore } from '../stores/editorBufferStore';

export async function flushDirtyBuffer(save: (content: string) => Promise<void>): Promise<void> {
  const bufferState = useEditorBufferStore.getState();
  if (bufferState.isDirty && bufferState.noteId) {
    await save(bufferState.liveContent);
  }
}

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
      void flushDirtyBuffer(content => handleUpdateNoteRef.current(content));
    };

    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    const unsubscribe = window.dripnex.editor.onFlushRequest(id => {
      void flushDirtyBuffer(content => handleUpdateNoteRef.current(content)).finally(() => {
        window.dripnex.editor.notifyFlushed(id);
      });
    });

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('dripnex:save-note', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('dripnex:save-note', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);
}
