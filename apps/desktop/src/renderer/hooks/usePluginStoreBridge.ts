import { useEffect, useRef, type RefObject } from 'react';
import {
  notifyHostStoreChanged,
  setHostStoreSnapshot,
  themeRegistryStore,
} from '@dripnex/plugin-api';
import type { NoteSnapshot } from '../../preload/index';
import { useEditorBufferStore } from '../stores/editorBufferStore';
import { useNavigationStore } from '../stores/navigationStore';
import { selectAppearance, useSettingsStore } from '../stores/settings';
import { buildAppStoreSnapshot } from '../plugins/buildAppStoreSnapshot';
import { useFilteredNotes } from './useNavigation';

/**
 * Push Query + Zustand into the plugin-api store facade.
 * Call once in the notes window (PluginHost lives there).
 */
export function usePluginStoreBridge(selectedNoteRef: RefObject<NoteSnapshot | null>): void {
  const visibleNotes = useFilteredNotes();
  const visibleRef = useRef(visibleNotes);
  visibleRef.current = visibleNotes;
  const current = selectedNoteRef.current;
  const currentKey = current ? `${current.id}:${current.updatedAt}:${current.title}` : '';

  useEffect(() => {
    const read = () => {
      const editing = useEditorBufferStore.getState();
      const nav = useNavigationStore.getState();
      const appearance = selectAppearance(useSettingsStore.getState());
      const themeState = themeRegistryStore.getState();
      const active = themeState.getActiveTheme();

      return buildAppStoreSnapshot({
        editing: {
          noteId: editing.noteId,
          liveContent: editing.liveContent,
          isDirty: editing.isDirty,
        },
        navigation: nav.navigation,
        view: {
          workspaceRootId: nav.workspaceRootId,
          workspaceListAll: nav.workspaceListAll,
          statusFilter: nav.statusFilter,
          tagFilter: nav.tagFilter,
          sortBy: nav.sortBy,
          sortOrder: nav.sortOrder,
        },
        visibleNotes: visibleRef.current,
        currentNote: selectedNoteRef.current,
        appearance: {
          theme: appearance.theme,
          accentColor: appearance.accentColor,
          activeThemeId: appearance.activeThemeId,
          performanceMode: appearance.performanceMode,
          frostTransparency: appearance.frostTransparency,
          zoomLevel: appearance.zoomLevel,
        },
        theme: {
          activeThemeId: themeState.activeThemeId,
          frosted: Boolean(active?.frosted),
        },
      });
    };

    setHostStoreSnapshot(read);
    const notify = () => notifyHostStoreChanged();
    const unsubs = [
      useEditorBufferStore.subscribe(notify),
      useNavigationStore.subscribe(notify),
      useSettingsStore.subscribe(notify),
      themeRegistryStore.subscribe(notify),
    ];
    notify();

    return () => {
      for (const unsub of unsubs) unsub();
      setHostStoreSnapshot(null);
    };
  }, [selectedNoteRef]);

  useEffect(() => {
    notifyHostStoreChanged();
  }, [visibleNotes, currentKey]);
}
