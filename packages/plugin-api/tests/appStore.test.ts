import { afterEach, describe, expect, it } from 'vitest';
import {
  EMPTY_STORE_SNAPSHOT,
  getHostStore,
  notifyHostStoreChanged,
  setHostStoreSnapshot,
} from '../src/store/appStore';
import { createInitApi } from '../src/loader/createInitApi';

afterEach(() => {
  setHostStoreSnapshot(null);
});

describe('app store facade', () => {
  it('starts empty before the host registers a snapshot', () => {
    expect(getHostStore().getState()).toEqual(EMPTY_STORE_SNAPSHOT);
    expect(getHostStore().getState()).not.toBe(EMPTY_STORE_SNAPSHOT);
  });

  it('projects the host snapshot and clones so plugins cannot write through', () => {
    setHostStoreSnapshot(() => ({
      ...EMPTY_STORE_SNAPSHOT,
      editingNote: { id: 'n1', content: 'hello', isDirty: true },
    }));

    const state = getHostStore().getState();
    expect(state.editingNote).toEqual({ id: 'n1', content: 'hello', isDirty: true });
    state.editingNote.content = 'mutated';
    expect(getHostStore().getState().editingNote.content).toBe('hello');
  });

  it('notifies subscribers when the host snapshot changes', () => {
    let body = 'a';
    setHostStoreSnapshot(() => ({
      ...EMPTY_STORE_SNAPSHOT,
      editingNote: { id: 'n1', content: body, isDirty: false },
    }));

    const seen: string[] = [];
    const unsub = getHostStore().subscribe(() => {
      seen.push(getHostStore().getState().editingNote.content);
    });

    body = 'b';
    notifyHostStoreChanged();
    body = 'c';
    notifyHostStoreChanged();
    unsub();
    body = 'd';
    notifyHostStoreChanged();

    expect(seen).toEqual(['b', 'c']);
  });

  it('exposes the same facade on InitApi as dripnex.store', () => {
    setHostStoreSnapshot(() => ({
      ...EMPTY_STORE_SNAPSHOT,
      notes: {
        items: [
          {
            id: 'n1',
            title: 'One',
            notebookId: 'inbox',
            tags: ['x'],
            wordCount: 3,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            isPinned: false,
            status: 'active',
          },
        ],
        current: { id: 'n1', title: 'One', content: 'hi' },
      },
    }));

    const api = createInitApi({ registerCommand: () => () => {} } as never);
    expect(api.store).toBe(getHostStore());
    expect(api.store.getState().notes.items).toHaveLength(1);
    expect(api.store.getState().notes.current?.id).toBe('n1');
    expect('dispatch' in api.store).toBe(false);
  });
});
