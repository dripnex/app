import { randomUUID } from 'node:crypto';
import { BrowserWindow, ipcMain } from 'electron';

const FLUSH_TIMEOUT_MS = 2500;

export async function flushOpenEditors(): Promise<void> {
  const windows = BrowserWindow.getAllWindows().filter(
    win => !win.isDestroyed() && !win.webContents.isDestroyed()
  );
  await Promise.allSettled(windows.map(flushWindow));
}

function flushWindow(win: BrowserWindow): Promise<void> {
  const id = randomUUID();
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      ipcMain.removeListener('editor:flushed', onFlush);
      resolve();
    };
    const onFlush = (_event: Electron.IpcMainEvent, replyId: unknown) => {
      if (replyId === id) done();
    };
    const timer = setTimeout(done, FLUSH_TIMEOUT_MS);
    ipcMain.on('editor:flushed', onFlush);
    try {
      win.webContents.send('editor:flush', id);
    } catch {
      done();
    }
  });
}
