import { describe, expect, it, vi } from 'vitest';
import { reloadPluginWindows, type PluginReloadWindow } from '../pluginReload';

function fakeWindow(overrides?: {
  destroyed?: boolean;
  contentsDestroyed?: boolean;
}): PluginReloadWindow & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn();
  const close = vi.fn();
  const destroy = vi.fn();
  const reload = vi.fn();
  return {
    send,
    isDestroyed: () => overrides?.destroyed === true,
    close,
    destroy,
    webContents: {
      isDestroyed: () => overrides?.contentsDestroyed === true,
      send,
      reload,
    },
  };
}

describe('reloadPluginWindows', () => {
  it('sends plugins:reload and does not quit or close windows', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const settings = fakeWindow();
    const notes = fakeWindow();

    reloadPluginWindows([settings, notes]);

    expect(settings.send).toHaveBeenCalledTimes(1);
    expect(settings.send).toHaveBeenCalledWith('plugins:reload');
    expect(notes.send).toHaveBeenCalledWith('plugins:reload');
    expect(settings.close).not.toHaveBeenCalled();
    expect(settings.destroy).not.toHaveBeenCalled();
    expect(notes.close).not.toHaveBeenCalled();
    expect(notes.destroy).not.toHaveBeenCalled();
    expect(settings.webContents.reload).not.toHaveBeenCalled();
    expect(notes.webContents.reload).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect([settings, notes].every(w => !w.isDestroyed())).toBe(true);
    exit.mockRestore();
  });

  it('skips destroyed windows and still leaves the rest alive', () => {
    const gone = fakeWindow({ destroyed: true });
    const contentsGone = fakeWindow({ contentsDestroyed: true });
    const alive = fakeWindow();

    reloadPluginWindows([gone, contentsGone, alive]);

    expect(gone.send).not.toHaveBeenCalled();
    expect(contentsGone.send).not.toHaveBeenCalled();
    expect(alive.send).toHaveBeenCalledWith('plugins:reload');
    expect(gone.close).not.toHaveBeenCalled();
    expect(gone.destroy).not.toHaveBeenCalled();
    expect(alive.close).not.toHaveBeenCalled();
    expect(alive.destroy).not.toHaveBeenCalled();
    expect(alive.isDestroyed()).toBe(false);
  });
});
