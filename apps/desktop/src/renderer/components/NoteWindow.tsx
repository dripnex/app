/**
 * NoteWindow Component
 *
 * Standalone note editor displayed in a separate window.
 * Receives noteId via URL query param.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NoteSnapshot, NoteStatus } from '../../preload/index';
import { useSyncLinks } from '../hooks/useLinks';
import { useAppearanceSettings } from '../hooks/useAppearanceSettings';
import { useOfficialThemes } from '../hooks/useOfficialThemes';
import { useThemeOverrides } from '@dripnex/plugin-api';
import { ToastProvider } from './Toast';
import { NoteEditor } from './NoteEditor';
import './NoteWindow.css';

interface NoteWindowContentProps {
  noteId: string;
}

function NoteWindowContent({ noteId }: NoteWindowContentProps) {
  useAppearanceSettings();
  useOfficialThemes();
  useThemeOverrides();
  const [note, setNote] = useState<NoteSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const syncLinks = useSyncLinks();

  // Load note on mount
  useEffect(() => {
    async function loadNote() {
      setLoading(true);
      setError(null);
      try {
        const result = await window.dripnex.notes.get(noteId);
        if (result.ok) {
          setNote(result.data);
        } else {
          setError('Note not found');
        }
      } catch {
        setError('Failed to load note');
      } finally {
        setLoading(false);
      }
    }
    void loadNote();
  }, [noteId]);

  // Update note content
  const handleUpdate = useCallback(
    async (content: string) => {
      if (!note) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        const updated = await window.dripnex.notes.update({ id: note.id, content });
        if (updated.ok) {
          setNote(updated.data);
          syncLinks.mutate({ noteId: note.id, content });
        }
      }, 500);
    },
    [note, syncLinks]
  );

  // Update note title
  const handleTitleUpdate = useCallback(
    async (title: string) => {
      if (!note) return;
      const updated = await window.dripnex.notes.updateTitle({ id: note.id, title });
      if (updated.ok) {
        setNote(updated.data);
        // Update window title
        document.title = title || 'Note';
      }
    },
    [note]
  );

  // Update note status
  const handleStatusChange = useCallback(
    async (status: NoteStatus) => {
      if (!note) return;
      const updated = await window.dripnex.notes.setStatus(note.id, status);
      if (updated.ok) {
        setNote(updated.data);
      }
    },
    [note]
  );

  if (loading) {
    return (
      <div className="note-window note-window--loading">
        <div className="note-window__spinner" />
        <span>Loading note...</span>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="note-window note-window--error">
        <span>{error || 'Note not found'}</span>
      </div>
    );
  }

  return (
    <div className="note-window">
      <NoteEditor
        note={note}
        onUpdate={handleUpdate}
        onTitleUpdate={handleTitleUpdate}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

interface NoteWindowProps {
  noteId: string;
}

export function NoteWindow({ noteId }: NoteWindowProps) {
  return (
    <ToastProvider>
      <NoteWindowContent noteId={noteId} />
    </ToastProvider>
  );
}
