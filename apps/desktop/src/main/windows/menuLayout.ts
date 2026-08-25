export type FileMenuSlot = 'settings' | 'separator' | 'quit' | 'close';

/** Linux/Windows File menu includes Settings. macOS keeps Settings in the app menu. */
export function fileMenuSlots(platform: NodeJS.Platform): FileMenuSlot[] {
  if (platform === 'darwin') return ['close'];
  return ['settings', 'separator', 'quit'];
}

export function appMenuIncludesSettings(platform: NodeJS.Platform): boolean {
  return platform === 'darwin';
}
