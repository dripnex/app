import { useMemo } from 'react';
import type { NotebookSnapshot } from '../../preload/index';
import { useNotebookList } from '../hooks/useNotebooks';

interface BreadcrumbProps {
  selectedNotebookId: string | null;
  onNavigate: (notebookId: string) => void;
}

/** Build the path from root to the selected notebook */
function buildPath(notebooks: NotebookSnapshot[], selectedId: string | null): NotebookSnapshot[] {
  if (!selectedId) return [];

  const notebookMap = new Map(notebooks.map(nb => [nb.id, nb]));
  const path: NotebookSnapshot[] = [];

  let current = notebookMap.get(selectedId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? notebookMap.get(current.parentId) : undefined;
  }

  return path;
}

export function Breadcrumb({ selectedNotebookId, onNavigate }: BreadcrumbProps) {
  const { data: notebooks = [] } = useNotebookList();

  const path = useMemo(
    () => buildPath(notebooks, selectedNotebookId),
    [notebooks, selectedNotebookId]
  );

  // Don't show breadcrumb if we're at root level (Inbox) or no selection
  if (path.length <= 1) {
    return null;
  }

  return (
    <nav className="breadcrumb" aria-label="Notebook path">
      {path.map((notebook, index) => {
        const isLast = index === path.length - 1;
        return (
          <span key={notebook.id} className="breadcrumb-segment">
            <button
              type="button"
              className={`breadcrumb-item ${isLast ? 'current' : ''}`}
              onClick={() => onNavigate(notebook.id)}
              aria-current={isLast ? 'location' : undefined}
            >
              <span className="breadcrumb-icon">{notebook.id === 'inbox' ? '📥' : '📁'}</span>
              <span className="breadcrumb-name">{notebook.name}</span>
            </button>
            {!isLast && (
              <span className="breadcrumb-separator" aria-hidden="true">
                /
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
