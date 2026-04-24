/**
 * Quick Capture Component
 *
 * Rendered in a small floating window for rapid note creation.
 * Opened via Cmd+Shift+N global shortcut or from the app.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './QuickCapture.module.css';

export function QuickCapture() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notebookId, setNotebookId] = useState('inbox');
  const [notebooks, setNotebooks] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Load notebooks on mount
  useEffect(() => {
    void window.readied.notebooks.list().then(nbs => {
      setNotebooks(nbs.map(nb => ({ id: nb.id, name: nb.name })));
    });
  }, []);

  // Auto-focus the title input
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleClose = useCallback(() => {
    void window.readied.windows.closeSelf();
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && !title.trim()) return;

    setSaving(true);
    try {
      // Build markdown content with title as H1 if provided
      const markdown = title.trim() ? `# ${title.trim()}\n\n${trimmedContent}` : trimmedContent;

      await window.readied.notes.create({
        content: markdown,
        notebookId: notebookId || undefined,
      });

      handleClose();
    } catch {
      // If save fails, keep the window open so user doesn't lose text
      setSaving(false);
    }
  }, [content, title, notebookId, handleClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape: close
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      // Cmd+Enter or Ctrl+Enter: save
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSave();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose, handleSave]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Quick Capture</span>
        <button
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close"
          type="button"
        >
          &times;
        </button>
      </div>

      <div className={styles.body}>
        <input
          ref={titleRef}
          className={styles.titleInput}
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className={styles.contentArea}
          placeholder="Write your note..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />
      </div>

      <div className={styles.footer}>
        <select
          className={styles.notebookSelect}
          value={notebookId}
          onChange={e => setNotebookId(e.target.value)}
        >
          <option value="inbox">Inbox</option>
          {notebooks
            .filter(nb => nb.id !== 'inbox')
            .map(nb => (
              <option key={nb.id} value={nb.id}>
                {nb.name}
              </option>
            ))}
        </select>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={handleClose} type="button">
            Cancel
            <span className={styles.shortcutHint}>Esc</span>
          </button>
          <button
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={saving || (!content.trim() && !title.trim())}
            type="button"
          >
            {saving ? 'Saving...' : 'Save'}
            <span className={styles.shortcutHint}>
              {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+\u23CE
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
