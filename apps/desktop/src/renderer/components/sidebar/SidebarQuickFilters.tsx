import { memo } from 'react';
import { List } from 'lucide-react';
import { sc } from './sc';

export type QuickFilterType = 'all' | 'pinned' | 'trash';

interface SidebarQuickFiltersProps {
  readonly allNotesCount: number;
  readonly allNotesSelected: boolean;
  readonly onSelectAll: () => void;
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
      className={sc('sidebar-row', isSelected && 'selected')}
      onClick={onClick}
      aria-pressed={isSelected}
    >
      <span className={sc('sidebar-row-icon')} aria-hidden="true">
        {icon}
      </span>
      <span className={sc('sidebar-row-label')}>{label}</span>
      <span className={sc('sidebar-row-count')} aria-label={`${count} notes`}>
        {count}
      </span>
    </button>
  );
});

export const SidebarQuickFilters = memo(function SidebarQuickFilters({
  allNotesCount,
  allNotesSelected,
  onSelectAll,
}: SidebarQuickFiltersProps) {
  return (
    <nav className={sc('sidebar-quick-filters')} aria-label="Quick filters">
      <QuickFilterItem
        icon={<List size={15} />}
        label="All Notes"
        count={allNotesCount}
        isSelected={allNotesSelected}
        onClick={onSelectAll}
      />
    </nav>
  );
});
