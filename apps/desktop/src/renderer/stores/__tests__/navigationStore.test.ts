import { describe, it, expect, beforeEach } from 'vitest';
import {
  useNavigationStore,
  selectNavigation,
  selectStatusFilter,
  selectIsNotebookContext,
  selectIsGlobalContext,
  selectIsTrashView,
  selectSelectedNotebookId,
  selectGlobalFilter,
} from '../navigationStore';

describe('navigationStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useNavigationStore.setState({
      navigation: { kind: 'global', filter: 'all' },
      statusFilter: null,
      tagFilter: null,
    });
  });

  describe('initial state', () => {
    it('starts with global/all navigation', () => {
      const state = useNavigationStore.getState();
      expect(state.navigation).toEqual({ kind: 'global', filter: 'all' });
    });

    it('starts with null statusFilter', () => {
      const state = useNavigationStore.getState();
      expect(state.statusFilter).toBeNull();
    });
  });

  describe('navigation actions', () => {
    it('goToAllNotes sets navigation to global/all', () => {
      // First change to something else
      useNavigationStore.getState().goToNotebook('test-id');
      // Then go to all notes
      useNavigationStore.getState().goToAllNotes();

      expect(useNavigationStore.getState().navigation).toEqual({
        kind: 'global',
        filter: 'all',
      });
    });

    it('goToPinned sets navigation to global/pinned', () => {
      useNavigationStore.getState().goToPinned();

      expect(useNavigationStore.getState().navigation).toEqual({
        kind: 'global',
        filter: 'pinned',
      });
    });

    it('goToTrash sets navigation to global/trash', () => {
      useNavigationStore.getState().goToTrash();

      expect(useNavigationStore.getState().navigation).toEqual({
        kind: 'global',
        filter: 'trash',
      });
    });

    it('goToNotebook sets navigation to notebook view with id', () => {
      useNavigationStore.getState().goToNotebook('notebook-123');

      expect(useNavigationStore.getState().navigation).toEqual({
        kind: 'notebook',
        id: 'notebook-123',
      });
    });

    it('goToTag sets the tag filter without leaving the current notebook', () => {
      useNavigationStore.getState().goToNotebook('inbox');
      useNavigationStore.getState().goToTag('javascript');

      const state = useNavigationStore.getState();
      expect(state.navigation).toEqual({ kind: 'notebook', id: 'inbox' });
      expect(state.tagFilter).toBe('javascript');
    });

    it('goToTag toggles the same tag off', () => {
      useNavigationStore.getState().goToTag('javascript');
      useNavigationStore.getState().goToTag('javascript');
      expect(useNavigationStore.getState().tagFilter).toBeNull();
    });

    it('goToSearch sets navigation to search view with query', () => {
      useNavigationStore.getState().goToSearch('test query');

      expect(useNavigationStore.getState().navigation).toEqual({
        kind: 'search',
        query: 'test query',
      });
    });

    it('clearNavigation resets to default (global/all)', () => {
      useNavigationStore.getState().goToNotebook('test');
      useNavigationStore.getState().clearNavigation();

      expect(useNavigationStore.getState().navigation).toEqual({
        kind: 'global',
        filter: 'all',
      });
    });
  });

  describe('status filter actions', () => {
    it('setStatusFilter sets the status filter', () => {
      useNavigationStore.getState().setStatusFilter('active');

      expect(useNavigationStore.getState().statusFilter).toBe('active');
    });

    it('setStatusFilter is orthogonal to navigation', () => {
      useNavigationStore.getState().goToNotebook('notebook-123');
      useNavigationStore.getState().setStatusFilter('completed');

      const state = useNavigationStore.getState();
      expect(state.navigation).toEqual({ kind: 'notebook', id: 'notebook-123' });
      expect(state.statusFilter).toBe('completed');
    });

    it('clearStatusFilter resets status filter to null', () => {
      useNavigationStore.getState().setStatusFilter('on_hold');
      useNavigationStore.getState().clearStatusFilter();

      expect(useNavigationStore.getState().statusFilter).toBeNull();
    });
  });

  describe('selectors', () => {
    describe('selectNavigation', () => {
      it('returns the navigation state', () => {
        useNavigationStore.getState().goToNotebook('id');
        const state = useNavigationStore.getState();

        expect(selectNavigation(state)).toEqual({ kind: 'notebook', id: 'id' });
      });
    });

    describe('selectStatusFilter', () => {
      it('returns the status filter', () => {
        useNavigationStore.getState().setStatusFilter('dropped');
        const state = useNavigationStore.getState();

        expect(selectStatusFilter(state)).toBe('dropped');
      });
    });

    describe('selectIsNotebookContext', () => {
      it('returns true when in notebook view', () => {
        useNavigationStore.getState().goToNotebook('id');
        const state = useNavigationStore.getState();

        expect(selectIsNotebookContext(state)).toBe(true);
      });

      it('returns false when in global view', () => {
        const state = useNavigationStore.getState();

        expect(selectIsNotebookContext(state)).toBe(false);
      });
    });

    describe('selectIsGlobalContext', () => {
      it('returns true when in global view', () => {
        const state = useNavigationStore.getState();

        expect(selectIsGlobalContext(state)).toBe(true);
      });

      it('returns false when in notebook view', () => {
        useNavigationStore.getState().goToNotebook('id');
        const state = useNavigationStore.getState();

        expect(selectIsGlobalContext(state)).toBe(false);
      });
    });

    describe('selectIsTrashView', () => {
      it('returns true when in trash view', () => {
        useNavigationStore.getState().goToTrash();
        const state = useNavigationStore.getState();

        expect(selectIsTrashView(state)).toBe(true);
      });

      it('returns false when in all notes view', () => {
        const state = useNavigationStore.getState();

        expect(selectIsTrashView(state)).toBe(false);
      });

      it('returns false when in notebook view', () => {
        useNavigationStore.getState().goToNotebook('id');
        const state = useNavigationStore.getState();

        expect(selectIsTrashView(state)).toBe(false);
      });
    });

    describe('selectSelectedNotebookId', () => {
      it('returns notebook id when in notebook view', () => {
        useNavigationStore.getState().goToNotebook('my-notebook');
        const state = useNavigationStore.getState();

        expect(selectSelectedNotebookId(state)).toBe('my-notebook');
      });

      it('returns null when not in notebook view', () => {
        const state = useNavigationStore.getState();

        expect(selectSelectedNotebookId(state)).toBeNull();
      });
    });

    describe('selectGlobalFilter', () => {
      it('returns filter when in global view', () => {
        useNavigationStore.getState().goToPinned();
        const state = useNavigationStore.getState();

        expect(selectGlobalFilter(state)).toBe('pinned');
      });

      it('returns null when not in global view', () => {
        useNavigationStore.getState().goToNotebook('id');
        const state = useNavigationStore.getState();

        expect(selectGlobalFilter(state)).toBeNull();
      });
    });
  });
});
