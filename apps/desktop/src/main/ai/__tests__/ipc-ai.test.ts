import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatHandle } from '@dripnex/ai-core';
import type { LLMEvent } from '@dripnex/ai-core';

const warn = vi.fn();

vi.mock('../../logger.js', () => ({
  getLogger: () => ({ warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { abortAllStreams, consumeStream, safeSend, trackHandle } from '../ipc-ai.js';

function fakeSender() {
  let destroyed = false;
  const send = vi.fn((..._args: unknown[]) => {
    if (destroyed) {
      throw new Error('Object has been destroyed');
    }
  });
  return {
    send,
    isDestroyed: () => destroyed,
    destroy: () => {
      destroyed = true;
    },
  };
}

function streamHandle(events: AsyncIterable<LLMEvent>, abort = vi.fn()): ChatHandle {
  return { requestId: 'req-1', events, abort };
}

describe('safeSend', () => {
  beforeEach(() => warn.mockReset());

  it('returns false and warns when webContents is already destroyed', () => {
    const sender = fakeSender();
    sender.destroy();
    expect(safeSend(sender as unknown as Electron.WebContents, 'ai:event', 'x')).toBe(false);
    expect(sender.send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { channel: 'ai:event' },
      'dropped IPC send: webContents destroyed'
    );
  });
});

describe('consumeStream', () => {
  beforeEach(() => {
    warn.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw when the sender dies mid-stream', async () => {
    const sender = fakeSender();
    const abort = vi.fn();

    async function* events(): AsyncGenerator<LLMEvent> {
      yield { type: 'text', delta: 'hello' };
      sender.destroy();
      await vi.advanceTimersByTimeAsync(50);
      yield { type: 'done', durationMs: 1 };
    }

    const run = consumeStream(
      sender as unknown as Electron.WebContents,
      streamHandle(events(), abort)
    );
    await vi.runAllTimersAsync();
    await expect(run).resolves.toBeUndefined();
    expect(abort).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { channel: 'ai:event' },
      'dropped IPC send: webContents destroyed'
    );
  });
});

describe('abortAllStreams', () => {
  it('aborts tracked handles without throwing', () => {
    const abort = vi.fn();
    trackHandle(1, streamHandle((async function* () {})(), abort));
    abortAllStreams();
    expect(abort).toHaveBeenCalled();
  });
});
