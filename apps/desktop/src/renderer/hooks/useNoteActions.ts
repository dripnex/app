import { useCallback } from 'react';
import type { AppAPIWithEvents, DataAPIWithEvents } from '@dripnex/plugin-api';
import type { NoteSnapshot, NoteStatus } from '../../preload/index';
import { useNoteMutations } from './useNotes';
import { useSyncLinks } from './useLinks';
import { useNavigationActions, useStatusFilter } from './useNavigation';

interface UseNoteActionsOptions {
  selectedNote: NoteSnapshot | null;
  setSelectedNote: (note: NoteSnapshot | null) => void;
  selectedNotebookId: string | null;
  clearSearch: () => void;
  appAPI: AppAPIWithEvents;
  dataAPI: DataAPIWithEvents;
  displayedNotes: NoteSnapshot[];
}

export function useNoteActions({
  selectedNote,
  setSelectedNote,
  selectedNotebookId,
  clearSearch,
  appAPI,
  dataAPI,
  displayedNotes,
}: UseNoteActionsOptions) {
  const {
    createNote,
    updateNote,
    updateNoteTitle,
    deleteNote,
    archiveNote,
    restoreNote,
    duplicateNote,
    moveNote,
    setNoteStatus,
    pinNote,
    unpinNote,
  } = useNoteMutations();

  const syncLinks = useSyncLinks();
  const { goToAllNotes } = useNavigationActions();
  const statusFilter = useStatusFilter();

  // Create new note (respects current navigation context)
  const handleNewNote = useCallback(async () => {
    const newNote = await createNote.mutateAsync({
      content: '# Untitled\n\n',
      notebookId: selectedNotebookId ?? undefined,
    });
    setSelectedNote(newNote);
    clearSearch();
    appAPI._notifyNoteCreated({ id: newNote.id, title: newNote.title, content: newNote.content });
    dataAPI._notifyNotesChanged({ kind: 'note', action: 'created', id: newNote.id });
  }, [createNote, selectedNotebookId, clearSearch, appAPI, dataAPI, setSelectedNote]);

  // Select note
  const handleSelectNote = useCallback(
    async (id: string) => {
      const result = await window.dripnex.notes.get(id);
      if (result.ok) {
        setSelectedNote(result.data);
        appAPI._notifyNoteSelected({
          id: result.data.id,
          title: result.data.title,
          content: result.data.content,
        });
      }
    },
    [appAPI, setSelectedNote]
  );

  // Handle wikilink click - best-effort navigation by title
  const handleWikilinkClick = useCallback(
    async (title: string) => {
      const notes = await window.dripnex.notes.search(title);
      if (notes.length > 0) {
        const match = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
        if (match) {
          void handleSelectNote(match.id);
        }
      }
    },
    [handleSelectNote]
  );

  // Update note content
  const handleUpdateNote = useCallback(
    async (content: string) => {
      if (!selectedNote) return;
      const updated = await updateNote.mutateAsync({ id: selectedNote.id, content });
      setSelectedNote(updated);
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'updated', id: selectedNote.id });
      // Sync links after save (fire-and-forget, don't block UI)
      syncLinks.mutate({ noteId: selectedNote.id, content });

      // Auto-commit to git if enabled (fire-and-forget, don't block UI)
      if (updated.notebookId) {
        try {
          const gitSettings = await window.dripnex.notebooks.getGitSettings(updated.notebookId);
          if (
            gitSettings.success &&
            gitSettings.settings?.enabled &&
            gitSettings.settings?.autoCommit
          ) {
            await window.dripnex.git.writeNote(updated.notebookId, updated.id, content);
            await window.dripnex.git.commit(updated.notebookId, `Update note: ${updated.title}`, [
              `${updated.id}.md`,
            ]);
          }
        } catch (error) {
          console.error('Auto-commit failed:', error);
        }
      }
    },
    [selectedNote, updateNote, syncLinks, dataAPI, setSelectedNote]
  );

  // Update note title
  const handleUpdateTitle = useCallback(
    async (title: string) => {
      if (!selectedNote) return;
      const updated = await updateNoteTitle.mutateAsync({ id: selectedNote.id, title });
      setSelectedNote(updated);
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'updated', id: selectedNote.id });

      if (updated.notebookId) {
        try {
          const gitSettings = await window.dripnex.notebooks.getGitSettings(updated.notebookId);
          if (
            gitSettings.success &&
            gitSettings.settings?.enabled &&
            gitSettings.settings?.autoCommit
          ) {
            await window.dripnex.git.writeNote(updated.notebookId, updated.id, updated.content);
            await window.dripnex.git.commit(updated.notebookId, `Rename note: ${updated.title}`, [
              `${updated.id}.md`,
            ]);
          }
        } catch (error) {
          console.error('Auto-commit failed:', error);
        }
      }
    },
    [selectedNote, updateNoteTitle, dataAPI, setSelectedNote]
  );

  // Delete note
  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote.mutateAsync(id);
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
      appAPI._notifyNoteDeleted(id);
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'deleted', id });
    },
    [selectedNote, deleteNote, appAPI, dataAPI, setSelectedNote]
  );

  // Archive note (toggle based on current state)
  const handleArchiveNote = useCallback(
    async (id: string) => {
      const result = await window.dripnex.notes.get(id);
      if (!result.ok) return;

      if (result.data.isArchived) {
        await restoreNote.mutateAsync(id);
      } else {
        await archiveNote.mutateAsync(id);
      }
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
    },
    [selectedNote, archiveNote, restoreNote, setSelectedNote]
  );

  // Duplicate note
  const handleDuplicateNote = useCallback(
    async (id: string) => {
      const duplicated = await duplicateNote.mutateAsync(id);
      setSelectedNote(duplicated);
      goToAllNotes();
    },
    [duplicateNote, goToAllNotes, setSelectedNote]
  );

  // Pin/unpin note (toggle)
  const handlePinNote = useCallback(
    async (id: string) => {
      const note = displayedNotes.find(n => n.id === id);
      if (!note) return;
      if (note.isPinned) {
        await unpinNote.mutateAsync(id);
      } else {
        await pinNote.mutateAsync(id);
      }
    },
    [displayedNotes, pinNote, unpinNote]
  );

  // Move note to notebook
  const handleMoveNote = useCallback(
    async (noteId: string, notebookId: string) => {
      await moveNote.mutateAsync({ noteId, notebookId });
    },
    [moveNote]
  );

  // Move current note to notebook (for editor header)
  const handleMoveSelectedNote = useCallback(
    async (notebookId: string) => {
      if (!selectedNote) return;
      const updated = await moveNote.mutateAsync({ noteId: selectedNote.id, notebookId });
      setSelectedNote(updated);
    },
    [selectedNote, moveNote, setSelectedNote]
  );

  // Change note status
  const handleStatusChange = useCallback(
    async (status: NoteStatus) => {
      if (!selectedNote) return;
      const updated = await setNoteStatus.mutateAsync({ id: selectedNote.id, status });
      if (statusFilter && status !== statusFilter) {
        setSelectedNote(null);
      } else {
        setSelectedNote(updated);
      }
    },
    [selectedNote, setNoteStatus, statusFilter, setSelectedNote]
  );

  return {
    handleNewNote,
    handleSelectNote,
    handleWikilinkClick,
    handleUpdateNote,
    handleUpdateTitle,
    handleDeleteNote,
    handleArchiveNote,
    handleDuplicateNote,
    handlePinNote,
    handleMoveNote,
    handleMoveSelectedNote,
    handleStatusChange,
  };
}
