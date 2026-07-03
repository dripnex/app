import { memo } from 'react';
import { FileText, Pin, Trash2, Network, KanbanSquare } from 'lucide-react';

export type QuickFilterType = 'all' | 'pinned' | 'trash';

interface SidebarQuickFiltersProps {
  readonly allNotesCount: number;
  readonly pinnedCount: number;
  readonly trashCount: number;
  readonly selectedFilter: QuickFilterType | null;
  readonly onSelectFilter: (filter: QuickFilterType) => void;
  readonly isNotebookContext?: boolean;
  readonly onOpenGraph?: () => void;
  readonly onOpenPlanning?: () => void;
  readonly isPlanningSelected?: boolean;
}

interface QuickFilterItemProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly count: number;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}

const QuickFilterItem = memo(function QuickFilterItem({
  icon,
  label,
  count,
  isSelected,
  onClick,
}: QuickFilterItemProps) {
  return (
    <button
      type="button"
      className={`sidebar-quick-filter ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
    >
      <span className="sidebar-quick-filter-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sidebar-quick-filter-label">{label}</span>
      <span className="sidebar-quick-filter-count" aria-label={`${count} notes`}>
        {count}
      </span>
    </button>
  );
});

export const SidebarQuickFilters = memo(function SidebarQuickFilters({
  allNotesCount,
  pinnedCount,
  trashCount,
  selectedFilter,
  onSelectFilter,
  isNotebookContext = false,
  onOpenGraph,
  onOpenPlanning,
  isPlanningSelected = false,
}: SidebarQuickFiltersProps) {
  return (
    <nav className="sidebar-quick-filters" aria-label="Quick filters">
      <QuickFilterItem
        icon={<FileText size={16} />}
        label="All Notes"
        count={allNotesCount}
        isSelected={selectedFilter === 'all'}
        onClick={() => onSelectFilter('all')}
      />
      {!isNotebookContext && (
        <QuickFilterItem
          icon={<Pin size={16} />}
          label="Pinned"
          count={pinnedCount}
          isSelected={selectedFilter === 'pinned'}
          onClick={() => onSelectFilter('pinned')}
        />
      )}
      {!isNotebookContext && (
        <QuickFilterItem
          icon={<Trash2 size={16} />}
          label="Trash"
          count={trashCount}
          isSelected={selectedFilter === 'trash'}
          onClick={() => onSelectFilter('trash')}
        />
      )}
      {onOpenPlanning && (
        <button
          type="button"
          className={`sidebar-quick-filter ${isPlanningSelected ? 'selected' : ''}`}
          onClick={onOpenPlanning}
          aria-pressed={isPlanningSelected}
          title="Open Planning board"
        >
          <span className="sidebar-quick-filter-icon" aria-hidden="true">
            <KanbanSquare size={16} />
          </span>
          <span className="sidebar-quick-filter-label">Planning</span>
        </button>
      )}
      {onOpenGraph && (
        <button
          type="button"
          className="sidebar-quick-filter sidebar-graph-btn"
          onClick={onOpenGraph}
          title="Open Graph View"
        >
          <span className="sidebar-quick-filter-icon" aria-hidden="true">
            <Network size={16} />
          </span>
          <span className="sidebar-quick-filter-label">Graph</span>
        </button>
      )}
    </nav>
  );
});
