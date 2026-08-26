import { describe, expect, it, vi } from 'vitest';
import type { ThemeDefinition } from '@dripnex/plugin-api';
import { finishThemePackInstall } from '../finishThemePackInstall';
import { reloadPluginWindows, type PluginReloadWindow } from '../../../main/plugins/pluginReload';

const limestone: ThemeDefinition = {
  id: 'dripnex-limestone',
  name: 'Limestone',
  colorScheme: 'light',
  pluginId: 'theme-limestone',
  tokens: { '--bg-base': '#e8e4dc', '--accent': '#8a7a62' },
};

function livingWindow(): {
  window: PluginReloadWindow;
  close: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn(() => {});
  const destroy = vi.fn(() => {});
  const send = vi.fn(() => {});
  const reload = vi.fn(() => {});
  return {
    window: {
      isDestroyed: () => false,
      close,
      destroy,
      webContents: {
        isDestroyed: () => false,
        send,
        reload,
      },
    },
    close,
    destroy,
    send,
    reload,
  };
}

describe('finishThemePackInstall', () => {
  it('activates the harvested palette then reloads without quitting or closing windows', async () => {
    const order: string[] = [];
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const settings = livingWindow();
    const notes = livingWindow();
    const activate = vi.fn((theme: ThemeDefinition) => {
      order.push(`activate:${theme.id}`);
    });

    const registered = await finishThemePackInstall({
      pluginId: 'theme-limestone',
      notifyRefresh: () => order.push('refresh-event'),
      refreshInstalled: async () => {
        order.push('scan');
      },
      syncThemes: async () => {
        order.push('harvest');
      },
      themes: () => [limestone],
      activate,
      requestReload: () => {
        order.push('reload');
        reloadPluginWindows([settings.window, notes.window]);
      },
    });

    expect(registered).toEqual(limestone);
    expect(order).toEqual([
      'refresh-event',
      'scan',
      'harvest',
      'activate:dripnex-limestone',
      'reload',
    ]);
    expect(activate).toHaveBeenCalledWith(limestone);
    expect(settings.send).toHaveBeenCalledWith('plugins:reload');
    expect(notes.send).toHaveBeenCalledWith('plugins:reload');
    expect(settings.close).not.toHaveBeenCalled();
    expect(settings.destroy).not.toHaveBeenCalled();
    expect(notes.close).not.toHaveBeenCalled();
    expect(notes.destroy).not.toHaveBeenCalled();
    expect(settings.reload).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(settings.window.isDestroyed()).toBe(false);
    expect(notes.window.isDestroyed()).toBe(false);
    exit.mockRestore();
  });

  it('still reloads when harvest has not registered the pack yet', async () => {
    const requestReload = vi.fn();
    const activate = vi.fn();
    const registered = await finishThemePackInstall({
      pluginId: 'theme-limestone',
      notifyRefresh: () => {},
      refreshInstalled: async () => {},
      syncThemes: async () => {},
      themes: () => [],
      activate,
      requestReload,
    });
    expect(registered).toBeUndefined();
    expect(activate).not.toHaveBeenCalled();
    expect(requestReload).toHaveBeenCalledTimes(1);
  });
});
