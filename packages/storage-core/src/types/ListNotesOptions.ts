/**
 * ListNotesOptions Type
 *
 * Query options for listing notes
 */

import type { NoteStatus } from '@dripnex/core';
import type { ArchivedFilter } from './ArchivedFilter.js';

/** Query options for listing notes */
export interface ListNotesOptions {
  limit?: number;
  offset?: number;
  tag?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  /** Filter by archived status. Defaults to 'active' (non-archived) */
  archived?: ArchivedFilter;
  notebookId?: string;
  status?: NoteStatus;
  isPinned?: boolean;
  /** Undefined = do not filter by deleted state */
  isDeleted?: boolean;
  excludeNotebookIds?: string[];
  /** AND of all listed tags; combined with `tag` when both are set */
  tags?: string[];
}
