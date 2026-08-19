/**
 * Persist GFM task totals on notes (Inkdrop numOfTasks / numOfCheckedTasks).
 * NULL means "not scanned yet" — readers recompute from content.
 */

import type { Migration } from '@dripnex/storage-core';

export const noteTasks: Migration = {
  version: 20260819000002,
  name: 'note_tasks',
  up: `
    ALTER TABLE notes ADD COLUMN task_count INTEGER;
    ALTER TABLE notes ADD COLUMN checked_task_count INTEGER;
  `,
};
