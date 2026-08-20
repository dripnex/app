import { describe, expect, it } from 'vitest';
import type { NoteSnapshot } from '../../../preload/index';
import { buildAppStoreSnapshot, toNoteSummary } from '../buildAppStoreSnapshot';

function note(overrides: Partial<NoteSnapshot> = {}): NoteSnapshot {
  return {
    id: 'n1',
    notebookId: 'inbox',
    content: 'body',
    title: 'Title',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    tags: ['tag'],
    wordCount: 1,
    taskCount: 0,
    checkedTaskCount: 0,
    archivedAt: null,
    isArchived: false,
    isPinned: false,
    isDeleted: false,
    status: 'active',
    ...overrides,
  };
}

describe('buildAppStoreSnapshot', () => {
  it('projects the visible list, not a fake library dump', () => {
    const current = note({ id: 'a', title: 'A' });
    const visible = [current, note({ id: 'b', title: 'B' })];
    const snapshot = buildAppStoreSnapshot({
      editing: { noteId: 'a', liveContent: 'live', isDirty: true },
      navigation: { kind: 'notebook', id: 'inbox' },
      view: {
        workspaceRootId: null,
        workspaceListAll: false,
        statusFilter: null,
        tagFilter: null,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
      visibleNotes: visible,
      currentNote: current,
      appearance: {
        theme: 'dark',
        accentColor: '#7dd3fc',
        activeThemeId: 'dripnex-glass',
        performanceMode: 'high',
        frostTransparency: 40,
        zoomLevel: '100',
      },
      theme: { activeThemeId: 'dripnex-glass', frosted: true },
    });

    expect(snapshot.notes.items).toEqual(visible.map(toNoteSummary));
    expect(snapshot.notes.current).toEqual({ id: 'a', title: 'A', content: 'live' });
    expect(snapshot.editingNote).toEqual({ id: 'a', content: 'live', isDirty: true });
    expect(snapshot.navigation).toEqual({ kind: 'notebook', id: 'inbox' });
    expect(snapshot.theme.frosted).toBe(true);
    expect(snapshot.settings.activeThemeId).toBe('dripnex-glass');
  });

  it('does not overlay live buffer onto a different current note', () => {
    const snapshot = buildAppStoreSnapshot({
      editing: { noteId: 'other', liveContent: 'draft', isDirty: true },
      navigation: { kind: 'global', filter: 'all' },
      view: {
        workspaceRootId: null,
        workspaceListAll: false,
        statusFilter: null,
        tagFilter: null,
        sortBy: 'title',
        sortOrder: 'asc',
      },
      visibleNotes: [],
      currentNote: note({ id: 'n1', content: 'saved' }),
      appearance: {
        theme: 'light',
        accentColor: '#0d8a80',
        activeThemeId: null,
        performanceMode: 'auto',
        frostTransparency: 0,
        zoomLevel: '110',
      },
      theme: { activeThemeId: null, frosted: false },
    });

    expect(snapshot.notes.current?.content).toBe('saved');
    expect(snapshot.editingNote.content).toBe('draft');
  });
});
