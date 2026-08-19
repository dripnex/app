/** Stable hook for user `styles.css` (Inkdrop per-notebook text annotations). */
export function notebookStyleClass(notebookId: string): string {
  const safe = notebookId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `notebook-${safe || 'id'}`;
}

/** Attribute selector to paste into styles.css. */
export function notebookStyleSelector(notebookId: string): string {
  return `[data-notebook-id=${JSON.stringify(notebookId)}]`;
}

export function notebookStyleProps(notebookId: string | null | undefined): {
  'data-notebook-id'?: string;
  className: string;
} {
  if (!notebookId) return { className: 'dripnex-note' };
  return {
    'data-notebook-id': notebookId,
    className: `dripnex-note ${notebookStyleClass(notebookId)}`,
  };
}
