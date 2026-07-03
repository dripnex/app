import { Search, X } from 'lucide-react';
import type { NotePriority } from '../../../preload/index';
import { PRIORITY_ORDER, PRIORITY_CONFIG } from './constants';

interface PlanningToolbarProps {
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly tag: string | null;
  readonly onTag: (value: string | null) => void;
  readonly priority: NotePriority | null;
  readonly onPriority: (value: NotePriority | null) => void;
  /** Tags available across the board's notes. */
  readonly tags: readonly string[];
  /** Whether any filter/search is active (to show the clear button). */
  readonly isFiltering: boolean;
  readonly onClear: () => void;
}

/** Search + tag/priority filters for the Planning board. */
export function PlanningToolbar({
  search,
  onSearch,
  tag,
  onTag,
  priority,
  onPriority,
  tags,
  isFiltering,
  onClear,
}: PlanningToolbarProps) {
  return (
    <div className="planning-toolbar">
      <div className="planning-toolbar__search">
        <Search size={14} className="planning-toolbar__search-icon" />
        <input
          type="text"
          className="planning-toolbar__input"
          placeholder="Search cards…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <select
        className="planning-toolbar__select"
        value={tag ?? ''}
        onChange={e => onTag(e.target.value || null)}
        aria-label="Filter by tag"
      >
        <option value="">All tags</option>
        {tags.map(t => (
          <option key={t} value={t}>
            #{t}
          </option>
        ))}
      </select>

      <select
        className="planning-toolbar__select"
        value={priority ?? ''}
        onChange={e => onPriority((e.target.value || null) as NotePriority | null)}
        aria-label="Filter by priority"
      >
        <option value="">All priorities</option>
        {PRIORITY_ORDER.map(p => (
          <option key={p} value={p}>
            {PRIORITY_CONFIG[p].label}
          </option>
        ))}
      </select>

      {isFiltering && (
        <button
          type="button"
          className="planning-toolbar__clear"
          onClick={onClear}
          title="Clear filters"
        >
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}
