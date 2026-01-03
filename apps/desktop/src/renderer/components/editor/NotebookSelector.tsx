import { useState, useRef, useEffect, memo } from 'react';
import { Folder, Inbox, ChevronDown, Check } from 'lucide-react';
import { useNotebookList } from '../../hooks/useNotebooks';

interface NotebookSelectorProps {
  readonly notebookId: string;
  readonly onMove: (notebookId: string) => void;
}

export const NotebookSelector = memo(function NotebookSelector({
  notebookId,
  onMove,
}: NotebookSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: notebooks = [] } = useNotebookList();

  // Find current notebook name
  const currentNotebook = notebooks.find(nb => nb.id === notebookId);
  const displayName = currentNotebook?.name ?? 'Inbox';
  const isInbox = notebookId === 'inbox';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (id: string) => {
    if (id !== notebookId) {
      onMove(id);
    }
    setIsOpen(false);
  };

  return (
    <div className="editor-header-dropdown" ref={containerRef}>
      <button
        type="button"
        className="editor-header-dropdown-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Notebook: ${displayName}`}
      >
        <span className="dropdown-icon">
          {isInbox ? <Inbox size={14} /> : <Folder size={14} />}
        </span>
        <span>{displayName}</span>
        <ChevronDown size={12} className="chevron-icon" />
      </button>

      {isOpen && (
        <div className="editor-header-menu" role="menu">
          {notebooks.map(notebook => (
            <button
              key={notebook.id}
              type="button"
              role="menuitem"
              className={`editor-header-menu-item notebook-selector-item ${notebook.id === notebookId ? 'selected' : ''}`}
              style={{ '--depth': notebook.depth } as React.CSSProperties}
              onClick={() => handleSelect(notebook.id)}
            >
              <span className="item-icon">
                {notebook.id === 'inbox' ? <Inbox size={14} /> : <Folder size={14} />}
              </span>
              <span className="item-label">{notebook.name}</span>
              {notebook.id === notebookId && (
                <span className="item-check">
                  <Check size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
