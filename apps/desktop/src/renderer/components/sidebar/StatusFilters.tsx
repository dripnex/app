import { memo } from 'react';
import type { NoteStatus } from '../../../preload/index';
import { StatusGlyph } from './StatusGlyph';
import { sc } from './sc';

interface StatusFiltersProps {
  readonly counts: Record<NoteStatus, number>;
  readonly selectedStatus: NoteStatus | null;
  readonly onSelectStatus: (status: NoteStatus | null) => void;
}

const statusConfig: Record<NoteStatus, { label: string }> = {
  active: { label: 'Active' },
  on_hold: { label: 'On Hold' },
  completed: { label: 'Completed' },
  dropped: { label: 'Dropped' },
};

export const StatusFilters = memo(function StatusFilters({
  counts,
  selectedStatus,
  onSelectStatus,
}: StatusFiltersProps) {
  const statuses: NoteStatus[] = ['active', 'on_hold', 'completed', 'dropped'];

  return (
    <nav className={sc('sidebar-status-filters')} aria-label="Status filters">
      {statuses.map(status => (
        <button
          key={status}
          type="button"
          className={sc('sidebar-row', selectedStatus === status && 'selected')}
          onClick={() => onSelectStatus(selectedStatus === status ? null : status)}
          aria-pressed={selectedStatus === status}
          data-status={status}
        >
          <span className={sc('sidebar-row-icon', 'sidebar-status-icon')} aria-hidden="true">
            <StatusGlyph status={status} />
          </span>
          <span className={sc('sidebar-row-label')}>{statusConfig[status].label}</span>
          <span className={sc('sidebar-row-count')} aria-label={`${counts[status] ?? 0} notes`}>
            {counts[status] ?? 0}
          </span>
        </button>
      ))}
    </nav>
  );
});
