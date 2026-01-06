import { useEffect } from 'react';
import type { NoteSnapshot } from '../../preload/index';

interface UseKeyboardShortcutsOptions {
  /** Handler for creating a new note */
  onNewNote: () => void;
  /** Handler for duplicating a note */
  onDuplicateNote: (noteId: string) => void;
  /** Handler for cycling view mode */
  onCycleViewMode: () => void;
  /** Handler for toggling graph view */
  onToggleGraph: () => void;
  /** Handler for closing graph view */
  onCloseGraph: () => void;
  /** Handler for clearing search */
  onClearSearch: () => void;
  /** Handler for deselecting note */
  onDeselectNote: () => void;
  /** Currently selected note */
  selectedNote: NoteSnapshot | null;
  /** Current search query */
  searchQuery: string;
  /** Whether graph view is open */
  isGraphOpen: boolean;
}

/**
 * Hook for managing global keyboard shortcuts.
 *
 * Shortcuts:
 * - Cmd/Ctrl+N: New note
 * - Cmd/Ctrl+F: Focus search
 * - Cmd/Ctrl+D: Duplicate note
 * - Cmd/Ctrl+Shift+P: Cycle view mode
 * - Cmd/Ctrl+G: Toggle graph view
 * - Escape: Close graph / clear search / deselect note
 */
export function useKeyboardShortcuts({
  onNewNote,
  onDuplicateNote,
  onCycleViewMode,
  onToggleGraph,
  onCloseGraph,
  onClearSearch,
  onDeselectNote,
  selectedNote,
  searchQuery,
  isGraphOpen,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'n') {
        e.preventDefault();
        onNewNote();
      }

      if (isMod && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      }

      if (isMod && e.key === 'd' && selectedNote) {
        e.preventDefault();
        onDuplicateNote(selectedNote.id);
      }

      // Cmd+Shift+P to cycle view mode (Editor → Split → Preview)
      if (isMod && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        onCycleViewMode();
      }

      // Cmd+G to toggle graph view
      if (isMod && e.key === 'g') {
        e.preventDefault();
        onToggleGraph();
      }

      if (e.key === 'Escape') {
        // Close graph first, then search, then deselect note
        if (isGraphOpen) {
          onCloseGraph();
        } else if (searchQuery) {
          onClearSearch();
        } else if (selectedNote) {
          onDeselectNote();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onNewNote,
    onDuplicateNote,
    onCycleViewMode,
    onToggleGraph,
    onCloseGraph,
    onClearSearch,
    onDeselectNote,
    selectedNote,
    searchQuery,
    isGraphOpen,
  ]);
}
