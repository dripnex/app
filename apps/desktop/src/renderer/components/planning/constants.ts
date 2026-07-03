import type { BoardStage } from '../../../preload/index';

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
