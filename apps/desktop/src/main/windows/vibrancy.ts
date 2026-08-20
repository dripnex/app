import type { BrowserWindowConstructorOptions } from 'electron';

/** Frosted chrome. Opaque fallback on Linux. Settings windows should stay solid. */
export function frostedWindowOptions(): Pick<
  BrowserWindowConstructorOptions,
  'vibrancy' | 'visualEffectState' | 'backgroundMaterial' | 'backgroundColor'
> {
  if (process.platform === 'darwin') {
    return {
      vibrancy: 'under-window',
      visualEffectState: 'active',
      backgroundColor: '#00000000',
    };
  }
  if (process.platform === 'win32') {
    return {
      backgroundMaterial: 'acrylic',
      backgroundColor: '#00000000',
    };
  }
  return { backgroundColor: '#0a0b0d' };
}
