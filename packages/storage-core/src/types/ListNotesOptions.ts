/**
 * ListNotesOptions Type
 *
 * Query options for listing notes
 */

import type { ArchivedFilter } from './ArchivedFilter.js';

/** Query options for listing notes */
export interface ListNotesOptions {
  limit?: number;
  offset?: number;
  tag?: string;
  /** Restrict results to a single notebook (filtered in SQL). */
  notebookId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  /** Filter by archived status. Defaults to 'active' (non-archived) */
  archived?: ArchivedFilter;
}
