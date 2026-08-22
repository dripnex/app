/** Display string for a Mod+key chord (⌘ on Apple, Ctrl elsewhere). */
export function modAccel(key: string): string {
  const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return apple ? `⌘${key}` : `Ctrl+${key}`;
}
