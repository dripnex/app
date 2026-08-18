const PREVIEW_SELECTOR = '[data-preview]';
const SCROLL_STEP_PX = 30;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function previewTarget(event: KeyboardEvent): HTMLElement | null {
  if (isTypingTarget(event.target)) return null;
  const preview = document.querySelector<HTMLElement>(PREVIEW_SELECTOR);
  if (!preview) return null;
  if (event.target instanceof Node && preview.contains(event.target)) return preview;
  const active = document.activeElement;
  if (active instanceof HTMLElement && (active.closest('.cm-editor') || active.closest('.cm-content'))) {
    return null;
  }
  if (document.querySelector('.cm-editor')) return null;
  return preview;
}

/**
 * j/k / Ctrl-d/u / Ctrl-f/b / gg / G on the markdown preview
 * when the editor is not the focus (preview-only, or preview pane focused).
 */
export function bindPreviewVimKeys(): () => void {
  let pendingG = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.metaKey) {
      pendingG = false;
      return;
    }
    const target = previewTarget(event);
    if (!target) {
      pendingG = false;
      return;
    }

    const key = event.key;
    if (pendingG && key === 'g' && !event.ctrlKey) {
      event.preventDefault();
      target.scrollTop = 0;
      pendingG = false;
      return;
    }
    pendingG = false;

    if (key === 'g' && !event.ctrlKey && !event.shiftKey) {
      pendingG = true;
      event.preventDefault();
      return;
    }
    if (key === 'G' && !event.ctrlKey) {
      event.preventDefault();
      target.scrollTop = target.scrollHeight;
      return;
    }
    if (key === 'j' && !event.ctrlKey) {
      event.preventDefault();
      target.scrollTop += SCROLL_STEP_PX;
      return;
    }
    if (key === 'k' && !event.ctrlKey) {
      event.preventDefault();
      target.scrollTop -= SCROLL_STEP_PX;
      return;
    }
    if (event.ctrlKey && (key === 'd' || key === 'D')) {
      event.preventDefault();
      target.scrollTop += target.clientHeight / 2;
      return;
    }
    if (event.ctrlKey && (key === 'u' || key === 'U')) {
      event.preventDefault();
      target.scrollTop -= target.clientHeight / 2;
      return;
    }
    if (event.ctrlKey && (key === 'f' || key === 'F')) {
      event.preventDefault();
      target.scrollTop += target.clientHeight;
      return;
    }
    if (event.ctrlKey && (key === 'b' || key === 'B')) {
      event.preventDefault();
      target.scrollTop -= target.clientHeight;
    }
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
