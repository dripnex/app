import { describe, expect, it } from 'vitest';
import { setHostCommandDispatch, setHostVim } from '../src/loader/hostBridges';
import { createInitApi } from '../src/loader/createInitApi';
import { EMPTY_STORE_SNAPSHOT, setHostStoreSnapshot } from '../src/store/appStore';

describe('hostBridges', () => {
  it('dispatches through the host and exposes vim on InitApi', async () => {
    const seen: string[] = [];
    setHostCommandDispatch(async id => {
      seen.push(id);
      return true;
    });
    setHostVim({ map: () => {} });

    const registerAiCommand = () => () => {};
    const api = createInitApi({
      registerCommand: () => () => {},
      registerAiCommand,
    } as never);

    expect(api.registerAiCommand).toBe(registerAiCommand);
    expect(api.vim).toEqual({ map: expect.any(Function) });
    expect(api.store.getState()).toEqual(EMPTY_STORE_SNAPSHOT);
    setHostStoreSnapshot(() => ({
      ...EMPTY_STORE_SNAPSHOT,
      editingNote: { id: 'n1', content: 'x', isDirty: false },
    }));
    expect(api.store.getState().editingNote.id).toBe('n1');
    setHostStoreSnapshot(null);
    await expect(api.commands.dispatch('app:next-note')).resolves.toBe(true);
    await expect(api.commands.dispatch('app:open-note', { noteId: 'n1' })).resolves.toBe(true);
    expect(seen).toEqual(['app:next-note', 'app:open-note']);

    setHostCommandDispatch(null);
    setHostVim(null);
    expect(api.vim).toBeNull();
    await expect(api.commands.dispatch('app:next-note')).resolves.toBe(false);
  });
});
