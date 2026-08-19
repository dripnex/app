import { useCallback } from 'react';
import type { AppAPIWithEvents, DataAPIWithEvents } from '@dripnex/plugin-api';
import type { NoteSnapshot, NoteStatus } from '../../preload/index';
import { useSettingsStore } from '../stores/settings';
import { useNoteMutations } from './useNotes';
import { useSyncLinks } from './useLinks';
import { useNavigationActions, useStatusFilter, useGlobalFilter } from './useNavigation';

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
    softDeleteNote,
    restoreDeletedNote,
  } = useNoteMutations();

  const syncLinks = useSyncLinks();
  const { goToAllNotes, goToNotebook } = useNavigationActions();
  const statusFilter = useStatusFilter();
  const globalFilter = useGlobalFilter();
  const defaultNotebookId = useSettingsStore(s => s.settings.general.defaultNotebookId);

  // Create new note (respects current navigation context)
  const handleNewNote = useCallback(async () => {
    if (globalFilter === 'trash') {
      goToAllNotes();
    }
    const notebookId =
      globalFilter === 'trash'
        ? 'inbox'
        : selectedNotebookId && selectedNotebookId !== 'templates'
          ? selectedNotebookId
          : defaultNotebookId || 'inbox';
    const newNote = await createNote.mutateAsync({
      content: '# Untitled\n\n',
      notebookId,
    });
    setSelectedNote(newNote);
    clearSearch();
    appAPI._notifyNoteCreated({ id: newNote.id, title: newNote.title, content: newNote.content });
    dataAPI._notifyNotesChanged({ kind: 'note', action: 'created', id: newNote.id });
  }, [
    createNote,
    selectedNotebookId,
    defaultNotebookId,
    globalFilter,
    goToAllNotes,
    clearSearch,
    appAPI,
    dataAPI,
    setSelectedNote,
  ]);

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

  const handleCreateLinkedNote = useCallback(
    async (title: string) => {
      const notebookId =
        selectedNotebookId && selectedNotebookId !== 'templates' ? selectedNotebookId : undefined;
      const newNote = await createNote.mutateAsync({
        content: `# ${title}\n\n`,
        notebookId,
      });
      setSelectedNote(newNote);
      clearSearch();
      appAPI._notifyNoteCreated({ id: newNote.id, title: newNote.title, content: newNote.content });
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'created', id: newNote.id });
    },
    [createNote, selectedNotebookId, setSelectedNote, clearSearch, appAPI, dataAPI]
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

  // Soft-delete note (move to trash)
  const handleDeleteNote = useCallback(
    async (id: string) => {
      await softDeleteNote.mutateAsync(id);
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
      appAPI._notifyNoteDeleted(id);
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'deleted', id });
    },
    [selectedNote, softDeleteNote, appAPI, dataAPI, setSelectedNote]
  );

  const handleRestoreDeleted = useCallback(
    async (id: string) => {
      await restoreDeletedNote.mutateAsync(id);
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'updated', id });
    },
    [selectedNote, restoreDeletedNote, dataAPI, setSelectedNote]
  );

  const handlePermanentDelete = useCallback(
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

  const handleCreateFromTemplate = useCallback(
    async (templateNoteId: string) => {
      const result = await window.dripnex.notes.get(templateNoteId);
      if (!result.ok) return;
      const destinationNotebookId =
        selectedNotebookId && selectedNotebookId !== 'templates'
          ? selectedNotebookId
          : defaultNotebookId || 'inbox';
      const newNote = await createNote.mutateAsync({
        content: result.data.content,
        notebookId: destinationNotebookId,
      });
      goToNotebook(destinationNotebookId);
      setSelectedNote(newNote);
      clearSearch();
      appAPI._notifyNoteCreated({ id: newNote.id, title: newNote.title, content: newNote.content });
      dataAPI._notifyNotesChanged({ kind: 'note', action: 'created', id: newNote.id });
    },
    [
      createNote,
      selectedNotebookId,
      defaultNotebookId,
      goToNotebook,
      setSelectedNote,
      clearSearch,
      appAPI,
      dataAPI,
    ]
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
    handleCreateLinkedNote,
    handleWikilinkClick,
    handleUpdateNote,
    handleUpdateTitle,
    handleDeleteNote,
    handleRestoreDeleted,
    handlePermanentDelete,
    handleArchiveNote,
    handleDuplicateNote,
    handleCreateFromTemplate,
    handlePinNote,
    handleMoveNote,
    handleMoveSelectedNote,
    handleStatusChange,
  };
}
