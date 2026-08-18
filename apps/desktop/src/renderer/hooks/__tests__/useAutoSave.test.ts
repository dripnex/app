import { describe, expect, it, vi } from 'vitest';
import { useEditorBufferStore } from '../../stores/editorBufferStore';
import { flushDirtyBuffer } from '../useAutoSave';

describe('flushDirtyBuffer', () => {
  it('saves when the buffer is dirty', async () => {
    useEditorBufferStore.getState().setNote('n1', 'old');
    useEditorBufferStore.getState().updateBuffer('new');
    const save = vi.fn(async () => undefined);
    await flushDirtyBuffer(save);
    expect(save).toHaveBeenCalledWith('new');
    useEditorBufferStore.getState().clear();
  });

  it('does nothing when the buffer is clean', async () => {
    useEditorBufferStore.getState().setNote('n1', 'same');
    const save = vi.fn(async () => undefined);
    await flushDirtyBuffer(save);
    expect(save).not.toHaveBeenCalled();
    useEditorBufferStore.getState().clear();
  });
});
