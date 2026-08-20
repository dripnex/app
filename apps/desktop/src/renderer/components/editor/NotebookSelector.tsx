import { useState, useRef, useEffect, memo } from 'react';
import { Folder, Inbox, ChevronDown, Check } from 'lucide';
import { Icon } from '../../ui/icons/Icon';
import { useNotebookList } from '../../hooks/useNotebooks';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';
import { sc } from './sc';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: notebooks = [] } = useNotebookList();

  // Auto-position dropdown to avoid viewport overflow
  const menuPosition = useDropdownPosition({
    triggerRef,
    menuRef,
    isOpen,
  });

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
    <div className={sc('editor-header-dropdown')} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={sc('editor-header-dropdown-btn')}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Notebook: ${displayName}`}
      >
        <span className={sc('dropdown-icon')}>
          {isInbox ? <Icon icon={Inbox} size={14} /> : <Icon icon={Folder} size={14} />}
        </span>
        <span>{displayName}</span>
        <Icon icon={ChevronDown} size={12} className={sc('chevron-icon')} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={sc('editor-header-menu')}
          role="menu"
          style={{
            top: menuPosition.top,
            bottom: menuPosition.bottom,
            left: menuPosition.left,
            right: menuPosition.right,
          }}
        >
          {notebooks.map(notebook => (
            <button
              key={notebook.id}
              type="button"
              role="menuitem"
              className={sc(
                'editor-header-menu-item',
                'notebook-selector-item',
                notebook.id === notebookId && 'selected'
              )}
              style={{ '--depth': notebook.depth } as React.CSSProperties}
              onClick={() => handleSelect(notebook.id)}
            >
              <span className={sc('item-icon')}>
                {notebook.id === 'inbox' ? (
                  <Icon icon={Inbox} size={14} />
                ) : (
                  <Icon icon={Folder} size={14} />
                )}
              </span>
              <span className={sc('item-label')}>{notebook.name}</span>
              {notebook.id === notebookId && (
                <span className={sc('item-check')}>
                  <Icon icon={Check} size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
