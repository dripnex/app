/**
 * Cross-window plugin reload. Renderers re-scan; this must not quit the app
 * or close BrowserWindows. Themes install on Linux AppImage was exiting
 * when a destructive reload raced palette activation.
 */

export interface PluginReloadWindow {
  isDestroyed(): boolean;
  close(): void;
  destroy(): void;
  webContents: {
    isDestroyed(): boolean;
    send(channel: string, ...args: unknown[]): void;
    reload?: () => void;
  };
}

/**
 * Notify living windows to re-scan plugins. Never process.exit, app.quit,
 * win.close, win.destroy, or webContents.reload.
 */
export function reloadPluginWindows(windows: readonly PluginReloadWindow[]): void {
  for (const win of windows) {
    try {
      if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
      win.webContents.send('plugins:reload');
    } catch {
      // Window destroyed between the check and send.
    }
  }
}
