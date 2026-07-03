import type { BoardStage, NotePriority } from '../../../preload/index';

/** Custom MIME type used to carry a note id during Kanban drag-and-drop. */
export const NOTE_MIME = 'application/x-dripnex-note';

/** Human-readable column titles for each board stage. */
export const BOARD_STAGE_LABELS: Record<BoardStage, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  in_staging: 'In Staging',
};

/** Priorities in menu order (highest urgency first). */
export const PRIORITY_ORDER: readonly NotePriority[] = ['urgent', 'high', 'medium', 'low', 'none'];

/** Label + dot color for each priority. */
export const PRIORITY_CONFIG: Record<NotePriority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high: { label: 'High', color: '#f97316' },
  medium: { label: 'Medium', color: '#eab308' },
  low: { label: 'Low', color: '#3b82f6' },
  none: { label: 'No priority', color: 'var(--text-faint)' },
};
