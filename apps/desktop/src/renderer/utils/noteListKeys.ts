/** Keys that move the note list. Stops at inputs, the editor, preview, and overlays. */
export function noteListNavDirection(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target: unknown;
}): 1 | -1 | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (isNoteListNavBlocked(event.target)) return null;
  if (event.key === 'j' || event.key === 'ArrowDown') return 1;
  if (event.key === 'k' || event.key === 'ArrowUp') return -1;
  return null;
}

type NavTarget = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

export function isNoteListNavBlocked(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as NavTarget;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
    return true;
  }
  if (typeof el.closest !== 'function') return false;
  return Boolean(
    el.closest('.cm-editor') ||
    el.closest('.cm-search') ||
    el.closest('[data-preview]') ||
    el.closest('[role="dialog"]') ||
    el.closest('.command-palette-overlay')
  );
}
