import { describe, it, expect, vi } from 'vitest';
import { createEditorAPI } from '../src/editor/createEditorAPI';

describe('createEditorAPI', () => {
  describe('events', () => {
    it('onDocChanged fires when notified', () => {
      const api = createEditorAPI(() => null);
      const cb = vi.fn();
      api.onDocChanged(cb);

      api._notifyDocChanged('new content');
      expect(cb).toHaveBeenCalledWith('new content');
    });

    it('onSelectionChanged fires when notified', () => {
      const api = createEditorAPI(() => null);
      const cb = vi.fn();
      api.onSelectionChanged(cb);

      api._notifySelectionChanged({ from: 5, to: 10 });
      expect(cb).toHaveBeenCalledWith({ from: 5, to: 10 });
    });

    it('unsubscribe removes listener', () => {
      const api = createEditorAPI(() => null);
      const cb = vi.fn();
      const unsub = api.onDocChanged(cb);

      unsub();
      api._notifyDocChanged('test');

      expect(cb).not.toHaveBeenCalled();
    });

    it('multiple listeners all fire', () => {
      const api = createEditorAPI(() => null);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      api.onSelectionChanged(cb1);
      api.onSelectionChanged(cb2);

      api._notifySelectionChanged({ from: 0, to: 0 });

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  describe('methods with null view', () => {
    it('getContent returns empty string when no view', () => {
      const api = createEditorAPI(() => null);
      expect(api.getContent()).toBe('');
    });

    it('getSelection returns zeros when no view', () => {
      const api = createEditorAPI(() => null);
      expect(api.getSelection()).toEqual({ from: 0, to: 0 });
    });

    it('getWordCount returns 0 for empty content', () => {
      const api = createEditorAPI(() => null);
      expect(api.getWordCount()).toBe(0);
    });

    it('getCharCount returns 0 for empty content', () => {
      const api = createEditorAPI(() => null);
      expect(api.getCharCount()).toBe(0);
    });

    it('getLineCount returns 0 when no view', () => {
      const api = createEditorAPI(() => null);
      expect(api.getLineCount()).toBe(0);
    });

    it('replaceRange is no-op when no view', () => {
      const api = createEditorAPI(() => null);
      expect(() => api.replaceRange(0, 1, 'x')).not.toThrow();
    });

    it('insertAtCursor is no-op when no view', () => {
      const api = createEditorAPI(() => null);
      expect(() => api.insertAtCursor('x')).not.toThrow();
    });

    it('focus is no-op when no view', () => {
      const api = createEditorAPI(() => null);
      expect(() => api.focus()).not.toThrow();
    });
  });
});
