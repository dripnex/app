import { describe, it, expect, beforeEach } from 'vitest';
import {
  useEditorPreferencesStore,
  selectViewMode,
  selectIsEditorVisible,
  selectIsPreviewVisible,
} from '../editorPreferencesStore';

describe('editorPreferencesStore', () => {
  beforeEach(() => {
    useEditorPreferencesStore.setState({ viewMode: 'editor' });
  });

  describe('initial state', () => {
    it('starts in editor mode', () => {
      expect(useEditorPreferencesStore.getState().viewMode).toBe('editor');
    });
  });

  describe('setViewMode', () => {
    it('sets view mode directly', () => {
      useEditorPreferencesStore.getState().setViewMode('split');
      expect(useEditorPreferencesStore.getState().viewMode).toBe('split');
    });

    it('can set to preview', () => {
      useEditorPreferencesStore.getState().setViewMode('preview');
      expect(useEditorPreferencesStore.getState().viewMode).toBe('preview');
    });
  });

  describe('cycleViewMode', () => {
    it('cycles editor → split → preview → editor', () => {
      const store = useEditorPreferencesStore.getState();

      expect(useEditorPreferencesStore.getState().viewMode).toBe('editor');

      store.cycleViewMode();
      expect(useEditorPreferencesStore.getState().viewMode).toBe('split');

      useEditorPreferencesStore.getState().cycleViewMode();
      expect(useEditorPreferencesStore.getState().viewMode).toBe('preview');

      useEditorPreferencesStore.getState().cycleViewMode();
      expect(useEditorPreferencesStore.getState().viewMode).toBe('editor');
    });
  });

  describe('selectors', () => {
    it('selectViewMode returns current mode', () => {
      useEditorPreferencesStore.getState().setViewMode('split');
      expect(selectViewMode(useEditorPreferencesStore.getState())).toBe('split');
    });

    it('selectIsEditorVisible: true for editor and split', () => {
      useEditorPreferencesStore.setState({ viewMode: 'editor' });
      expect(selectIsEditorVisible(useEditorPreferencesStore.getState())).toBe(true);

      useEditorPreferencesStore.setState({ viewMode: 'split' });
      expect(selectIsEditorVisible(useEditorPreferencesStore.getState())).toBe(true);

      useEditorPreferencesStore.setState({ viewMode: 'preview' });
      expect(selectIsEditorVisible(useEditorPreferencesStore.getState())).toBe(false);
    });

    it('selectIsPreviewVisible: true for preview and split', () => {
      useEditorPreferencesStore.setState({ viewMode: 'preview' });
      expect(selectIsPreviewVisible(useEditorPreferencesStore.getState())).toBe(true);

      useEditorPreferencesStore.setState({ viewMode: 'split' });
      expect(selectIsPreviewVisible(useEditorPreferencesStore.getState())).toBe(true);

      useEditorPreferencesStore.setState({ viewMode: 'editor' });
      expect(selectIsPreviewVisible(useEditorPreferencesStore.getState())).toBe(false);
    });
  });
});
