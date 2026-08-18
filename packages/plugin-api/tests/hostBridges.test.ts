import { describe, expect, it } from 'vitest';
import {
  dispatchHostCommand,
  getHostVim,
  setHostCommandDispatch,
  setHostVim,
} from '../src/loader/hostBridges';
import { createInitApi } from '../src/loader/createInitApi';

describe('hostBridges', () => {
  it('dispatches through the host and exposes vim on InitApi', async () => {
    const seen: string[] = [];
    setHostCommandDispatch(async id => {
      seen.push(id);
      return true;
    });
    setHostVim({ map: () => {} });

    const api = createInitApi({
      registerCommand: () => () => {},
    } as never);

    expect(api.vim).toEqual({ map: expect.any(Function) });
    await expect(api.commands.dispatch('app:next-note')).resolves.toBe(true);
    expect(seen).toEqual(['app:next-note']);

    setHostCommandDispatch(null);
    setHostVim(null);
    expect(api.vim).toBeNull();
    await expect(api.commands.dispatch('app:next-note')).resolves.toBe(false);
  });
});
