import { useMemo, useCallback } from 'react';
import { Folder, ChevronRight } from 'lucide-react';
import { useNotebookTree, getNotebookPath } from '../../hooks/useNotebooks';

interface SidebarBreadcrumbProps {
  readonly selectedNotebookId: string | null;
  readonly onNavigate: (id: string | null) => void;
}

export function SidebarBreadcrumb({ selectedNotebookId, onNavigate }: SidebarBreadcrumbProps) {
  const { data: tree } = useNotebookTree();

  const path = useMemo(
    () => getNotebookPath(selectedNotebookId, tree ?? []),
    [selectedNotebookId, tree]
  );

  const handleRootClick = useCallback(() => {
    onNavigate(null);
  }, [onNavigate]);

  const handleItemClick = useCallback(
    (id: string) => {
      onNavigate(id);
    },
    [onNavigate]
  );

  // Don't render if no notebook is selected
  if (!selectedNotebookId || path.length === 0) {
    return null;
  }

  return (
    <nav className="sidebar-breadcrumb" aria-label="Notebook path">
      <button
        type="button"
        className="sidebar-breadcrumb-icon"
        onClick={handleRootClick}
        aria-label="Go to all notebooks"
      >
        <Folder size={14} aria-hidden="true" />
      </button>

      {path.map((item, index) => {
        const isLast = index === path.length - 1;
        return (
          <span key={item.id} className="sidebar-breadcrumb-segment">
            <ChevronRight size={10} className="sidebar-breadcrumb-separator" aria-hidden="true" />
            <button
              type="button"
              className={`sidebar-breadcrumb-item ${isLast ? 'current' : ''}`}
              onClick={() => handleItemClick(item.id)}
              aria-current={isLast ? 'location' : undefined}
            >
              {item.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
