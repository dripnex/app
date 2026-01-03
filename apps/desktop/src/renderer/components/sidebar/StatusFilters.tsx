import { memo } from 'react';
import { Circle, CircleDot, CheckCircle2, XCircle } from 'lucide-react';
import type { NoteStatus } from '../../../preload/index';

interface StatusFiltersProps {
  readonly counts: Record<NoteStatus, number>;
  readonly selectedStatus: NoteStatus | null;
  readonly onSelectStatus: (status: NoteStatus | null) => void;
}

interface StatusFilterItemProps {
  readonly status: NoteStatus;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly count: number;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}

const statusConfig: Record<NoteStatus, { label: string; icon: React.ReactNode }> = {
  active: { label: 'Active', icon: <Circle size={14} /> },
  on_hold: { label: 'On Hold', icon: <CircleDot size={14} /> },
  completed: { label: 'Completed', icon: <CheckCircle2 size={14} /> },
  dropped: { label: 'Dropped', icon: <XCircle size={14} /> },
};

const StatusFilterItem = memo(function StatusFilterItem({
  status,
  label,
  icon,
  count,
  isSelected,
  onClick,
}: StatusFilterItemProps) {
  return (
    <button
      type="button"
      className={`sidebar-status-filter ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
      data-status={status}
    >
      <span className="sidebar-status-filter-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sidebar-status-filter-label">{label}</span>
      <span className="sidebar-status-filter-count" aria-label={`${count} notes`}>
        {count}
      </span>
    </button>
  );
});

export const StatusFilters = memo(function StatusFilters({
  counts,
  selectedStatus,
  onSelectStatus,
}: StatusFiltersProps) {
  const statuses: NoteStatus[] = ['active', 'on_hold', 'completed', 'dropped'];

  return (
    <nav className="sidebar-status-filters" aria-label="Status filters">
      {statuses.map(status => {
        const config = statusConfig[status];
        return (
          <StatusFilterItem
            key={status}
            status={status}
            label={config.label}
            icon={config.icon}
            count={counts[status] ?? 0}
            isSelected={selectedStatus === status}
            onClick={() => onSelectStatus(selectedStatus === status ? null : status)}
          />
        );
      })}
    </nav>
  );
});
