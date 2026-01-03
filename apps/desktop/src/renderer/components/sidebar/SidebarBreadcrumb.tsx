import { useMemo, useCallback } from 'react';
import { Folder, ChevronRight, X } from 'lucide-react';
import { useNotebookTree, getNotebookPath } from '../../hooks/useNotebooks';

interface SidebarBreadcrumbProps {
  readonly selectedNotebookId: string | null;
  readonly tagFilter: string | null;
  readonly onNavigate: (id: string | null) => void;
  readonly onClearTagFilter: () => void;
}

export function SidebarBreadcrumb({
  selectedNotebookId,
  tagFilter,
  onNavigate,
  onClearTagFilter,
}: SidebarBreadcrumbProps) {
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

  // Show breadcrumb if notebook is selected OR tag filter is active
  const hasNotebookPath = selectedNotebookId && path.length > 0;
  if (!hasNotebookPath && !tagFilter) {
    return null;
  }

  return (
    <nav className="sidebar-breadcrumb" aria-label="Notebook path">
      {hasNotebookPath && (
        <>
          <button
            type="button"
            className="sidebar-breadcrumb-icon"
            onClick={handleRootClick}
            aria-label="Go to all notebooks"
          >
            <Folder size={14} aria-hidden="true" />
          </button>

          {path.map((item, index) => {
            const isLast = index === path.length - 1 && !tagFilter;
            return (
              <span key={item.id} className="sidebar-breadcrumb-segment">
                <ChevronRight
                  size={10}
                  className="sidebar-breadcrumb-separator"
                  aria-hidden="true"
                />
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
        </>
      )}

      {tagFilter && (
        <span className="sidebar-breadcrumb-segment">
          {hasNotebookPath && (
            <ChevronRight size={10} className="sidebar-breadcrumb-separator" aria-hidden="true" />
          )}
          <span className="sidebar-breadcrumb-tag">
            <span className="sidebar-breadcrumb-tag-name">#{tagFilter}</span>
            <button
              type="button"
              className="sidebar-breadcrumb-tag-clear"
              onClick={onClearTagFilter}
              aria-label={`Clear tag filter: ${tagFilter}`}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        </span>
      )}
    </nav>
  );
}
