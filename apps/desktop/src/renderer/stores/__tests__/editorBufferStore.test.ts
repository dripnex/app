import { describe, it, expect, beforeEach } from 'vitest';
import {
  useEditorBufferStore,
  selectLiveContent,
  selectNoteId,
  selectIsDirty,
  selectContentForNote,
} from '../editorBufferStore';

describe('editorBufferStore', () => {
  beforeEach(() => {
    useEditorBufferStore.setState({
      noteId: null,
      liveContent: '',
      isDirty: false,
    });
  });

  describe('initial state', () => {
    it('starts with null noteId and empty content', () => {
      const state = useEditorBufferStore.getState();
      expect(state.noteId).toBeNull();
      expect(state.liveContent).toBe('');
      expect(state.isDirty).toBe(false);
    });
  });

  describe('setNote', () => {
    it('sets noteId and content, marks clean', () => {
      useEditorBufferStore.getState().setNote('note-1', '# Hello');

      const state = useEditorBufferStore.getState();
      expect(state.noteId).toBe('note-1');
      expect(state.liveContent).toBe('# Hello');
      expect(state.isDirty).toBe(false);
    });

    it('switching notes resets dirty flag', () => {
      const store = useEditorBufferStore.getState();
      store.setNote('note-1', 'content');
      store.updateBuffer('changed');
      expect(useEditorBufferStore.getState().isDirty).toBe(true);

      store.setNote('note-2', 'other');
      expect(useEditorBufferStore.getState().isDirty).toBe(false);
    });
  });

  describe('updateBuffer', () => {
    it('marks dirty when content changes', () => {
      const store = useEditorBufferStore.getState();
      store.setNote('note-1', 'original');
      store.updateBuffer('modified');

      const state = useEditorBufferStore.getState();
      expect(state.liveContent).toBe('modified');
      expect(state.isDirty).toBe(true);
    });

    it('does not mark dirty when content is the same', () => {
      const store = useEditorBufferStore.getState();
      store.setNote('note-1', 'same');
      store.updateBuffer('same');

      expect(useEditorBufferStore.getState().isDirty).toBe(false);
    });
  });

  describe('markClean', () => {
    it('resets isDirty to false', () => {
      const store = useEditorBufferStore.getState();
      store.setNote('note-1', 'a');
      store.updateBuffer('b');
      expect(useEditorBufferStore.getState().isDirty).toBe(true);

      store.markClean();
      expect(useEditorBufferStore.getState().isDirty).toBe(false);
    });
  });

  describe('clear', () => {
    it('resets all state', () => {
      const store = useEditorBufferStore.getState();
      store.setNote('note-1', 'content');
      store.updateBuffer('changed');

      store.clear();
      const state = useEditorBufferStore.getState();
      expect(state.noteId).toBeNull();
      expect(state.liveContent).toBe('');
      expect(state.isDirty).toBe(false);
    });
  });

  describe('selectors', () => {
    it('selectLiveContent returns content', () => {
      useEditorBufferStore.getState().setNote('n', 'hello');
      expect(selectLiveContent(useEditorBufferStore.getState())).toBe('hello');
    });

    it('selectNoteId returns noteId', () => {
      useEditorBufferStore.getState().setNote('abc', '');
      expect(selectNoteId(useEditorBufferStore.getState())).toBe('abc');
    });

    it('selectIsDirty reflects dirty state', () => {
      const store = useEditorBufferStore.getState();
      expect(selectIsDirty(useEditorBufferStore.getState())).toBe(false);
      store.setNote('n', 'a');
      store.updateBuffer('b');
      expect(selectIsDirty(useEditorBufferStore.getState())).toBe(true);
    });

    it('selectContentForNote returns content only for matching noteId', () => {
      useEditorBufferStore.getState().setNote('note-1', 'my content');

      expect(selectContentForNote('note-1')(useEditorBufferStore.getState())).toBe('my content');
      expect(selectContentForNote('note-2')(useEditorBufferStore.getState())).toBeNull();
      expect(selectContentForNote(null)(useEditorBufferStore.getState())).toBeNull();
    });
  });
});
