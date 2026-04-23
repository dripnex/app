import { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useNavigationStore } from '../stores/navigationStore';
import type { NoteStatus } from '../../preload/index';
import type { SortBy, SortOrder } from '../hooks/useNavigation';
import styles from './NoteListFilterBar.module.css';

// ============================================================================
// Status options
// ============================================================================

const STATUS_OPTIONS: Array<{ value: NoteStatus | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

// ============================================================================
// Sort options for the dropdown
// ============================================================================

const SORT_BY_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'createdAt', label: 'Created' },
  { value: 'title', label: 'Title' },
];

// ============================================================================
// Component
// ============================================================================

interface NoteListFilterBarProps {
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortChange: (sortBy: SortBy, sortOrder: SortOrder) => void;
}

export function NoteListFilterBar({ sortBy, sortOrder, onSortChange }: NoteListFilterBarProps) {
  const statusFilter = useNavigationStore(s => s.statusFilter);
  const tagFilter = useNavigationStore(s => s.tagFilter);
  const setStatusFilter = useNavigationStore(s => s.setStatusFilter);
  const setTagFilter = useNavigationStore(s => s.setTagFilter);

  const [tags, setTags] = useState<string[]>([]);

  // Load tags from the main process
  useEffect(() => {
    void window.readied.notes.tags().then(setTags);
  }, []);

  const handleStatusClick = useCallback(
    (status: NoteStatus | null) => {
      setStatusFilter(status);
    },
    [setStatusFilter]
  );

  const handleTagChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setTagFilter(value === '' ? null : value);
    },
    [setTagFilter]
  );

  const handleSortByChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSortChange(e.target.value as SortBy, sortOrder);
    },
    [onSortChange, sortOrder]
  );

  const handleSortOrderToggle = useCallback(() => {
    onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc');
  }, [onSortChange, sortBy, sortOrder]);

  return (
    <div className={styles.filterBar}>
      {/* Status pills */}
      <div className={styles.row}>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.label}
            type="button"
            className={`${styles.pill} ${statusFilter === opt.value ? styles.pillActive : ''}`}
            onClick={() => handleStatusClick(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tag + Sort row */}
      <div className={styles.row}>
        <label className={styles.label} htmlFor="filter-tag">
          Tag
        </label>
        <select
          id="filter-tag"
          className={styles.select}
          value={tagFilter ?? ''}
          onChange={handleTagChange}
        >
          <option value="">All tags</option>
          {tags.map(tag => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        <span className={styles.sep} />

        <label className={styles.label} htmlFor="filter-sort">
          Sort
        </label>
        <select
          id="filter-sort"
          className={styles.select}
          value={sortBy}
          onChange={handleSortByChange}
        >
          {SORT_BY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.pill}
          onClick={handleSortOrderToggle}
          aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
        >
          {sortOrder === 'asc' ? '\u2191 Asc' : '\u2193 Desc'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Toggle button (used in the NoteList header area)
// ============================================================================

interface FilterToggleButtonProps {
  isOpen: boolean;
  activeCount: number;
  onClick: () => void;
}

export function FilterToggleButton({ isOpen, activeCount, onClick }: FilterToggleButtonProps) {
  return (
    <div className={styles.toggleWrapper}>
      <button
        type="button"
        className={`${styles.toggleBtn} ${isOpen ? styles.toggleBtnActive : ''}`}
        onClick={onClick}
        aria-label="Toggle filters"
        aria-expanded={isOpen}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
      </button>
      {activeCount > 0 && !isOpen && <span className={styles.badge}>{activeCount}</span>}
    </div>
  );
}
