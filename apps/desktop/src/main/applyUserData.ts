/**
 * Force Electron onto the Dripnex userData folder (#572).
 * Must run before app.getPath('userData') and requestSingleInstanceLock.
 */

import { app } from 'electron';
import { hasExplicitUserDataDir, resolveElectronUserData } from '@dripnex/storage-core';

export function applyProductUserData(): void {
  const currentUserData = hasExplicitUserDataDir(process.argv) ? app.getPath('userData') : '';
  const resolved = resolveElectronUserData(currentUserData, { argv: process.argv });
  app.setName(resolved.name);
  if (resolved.setUserDataPath) {
    app.setPath('userData', resolved.userData);
  }
}
