import type { AppStoreSnapshot, NoteInfo, NoteSummaryInfo } from '@dripnex/plugin-api';
import type { NoteSnapshot } from '../../preload/index';
import type {
  NavigationState,
  SortBy,
  SortOrder,
  StatusFilter,
  TagFilter,
} from '../stores/navigationStore';

export interface AppStoreSnapshotInput {
  editing: {
    noteId: string | null;
    liveContent: string;
    isDirty: boolean;
  };
  navigation: NavigationState;
  view: {
    workspaceRootId: string | null;
    workspaceListAll: boolean;
    statusFilter: StatusFilter;
    tagFilter: TagFilter;
    sortBy: SortBy;
    sortOrder: SortOrder;
  };
  visibleNotes: ReadonlyArray<NoteSnapshot>;
  currentNote: NoteSnapshot | null;
  appearance: {
    theme: 'dark' | 'light' | 'system';
    accentColor: string;
    activeThemeId: string | null;
    performanceMode: 'auto' | 'high' | 'medium' | 'low';
    frostTransparency: number;
    zoomLevel: string;
  };
  theme: {
    activeThemeId: string | null;
    frosted: boolean;
  };
}

export function toNoteSummary(note: NoteSnapshot): NoteSummaryInfo {
  return {
    id: note.id,
    title: note.title,
    notebookId: note.notebookId,
    tags: [...note.tags],
    wordCount: note.wordCount,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    isPinned: note.isPinned,
    status: note.status,
  };
}

function toNoteInfo(note: NoteSnapshot, liveContent: string | null): NoteInfo {
  return {
    id: note.id,
    title: note.title,
    content: liveContent ?? note.content,
  };
}

export function buildAppStoreSnapshot(input: AppStoreSnapshotInput): AppStoreSnapshot {
  const live =
    input.currentNote && input.editing.noteId === input.currentNote.id
      ? input.editing.liveContent
      : null;

  return {
    editingNote: {
      id: input.editing.noteId,
      content: input.editing.liveContent,
      isDirty: input.editing.isDirty,
    },
    notes: {
      items: input.visibleNotes.map(toNoteSummary),
      current: input.currentNote ? toNoteInfo(input.currentNote, live) : null,
    },
    navigation: input.navigation,
    view: { ...input.view },
    settings: { ...input.appearance },
    theme: { ...input.theme },
  };
}
