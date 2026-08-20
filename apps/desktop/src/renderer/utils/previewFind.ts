const MARK_ATTR = 'data-preview-find';

export function nextFindIndex(count: number, current: number, direction: 1 | -1): number {
  if (count <= 0) return 0;
  return (current + direction + count) % count;
}

export function unwrapPreviewFindMarks(root: HTMLElement): void {
  const marks = root.querySelectorAll(`mark[${MARK_ATTR}]`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

/** Wrap case-insensitive matches. Returns how many marks were created. */
export function applyPreviewFind(root: HTMLElement, query: string, activeIndex: number): number {
  unwrapPreviewFindMarks(root);
  const needle = query.trim();
  if (!needle) return 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || parent.closest('mark[data-preview-find]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const lower = needle.toLowerCase();
  const hits: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    hits.push(node as Text);
    node = walker.nextNode();
  }

  let count = 0;
  for (const textNode of hits) {
    const value = textNode.data;
    const valueLower = value.toLowerCase();
    let from = 0;
    let cursor = valueLower.indexOf(lower, from);
    if (cursor < 0) continue;

    const frag = document.createDocumentFragment();
    while (cursor >= 0) {
      if (cursor > from) frag.append(value.slice(from, cursor));
      const mark = document.createElement('mark');
      mark.setAttribute(MARK_ATTR, '');
      if (count === activeIndex) mark.setAttribute('data-preview-find-active', '');
      mark.textContent = value.slice(cursor, cursor + needle.length);
      frag.append(mark);
      count += 1;
      from = cursor + needle.length;
      cursor = valueLower.indexOf(lower, from);
    }
    if (from < value.length) frag.append(value.slice(from));
    textNode.parentNode?.replaceChild(frag, textNode);
  }

  const active = root.querySelector<HTMLElement>('mark[data-preview-find-active]');
  active?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return count;
}
