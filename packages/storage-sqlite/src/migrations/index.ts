/**
 * Migration exports
 */

import type { Migration } from '@readied/storage-core';
import { initialSchema } from './001_initial_schema.js';
import { addArchivedAt } from './002_add_archived_at.js';
import { addNotebooks } from './003_notebooks.js';
import { addNoteFields } from './004_note_fields.js';
import { addManualTags } from './005_manual_tags.js';
import { addTagColors } from './006_tag_colors.js';
import { addLinks } from './007_links.js';
import { addFts5Index } from './008_fts5_index.js';
import { addLinkAnchors } from './009_link_anchors.js';
import { addSyncFields } from './010_sync_fields.js';
import { syncTracking } from './011_sync_tracking.js';
import { gitNotebooks } from './012_git_notebooks.js';

/** All migrations in order */
export const allMigrations: Migration[] = [
  initialSchema,
  addArchivedAt,
  addNotebooks,
  addNoteFields,
  addManualTags,
  addTagColors,
  addLinks,
  addFts5Index,
  addLinkAnchors,
  addSyncFields,
  syncTracking,
  gitNotebooks,
];

export {
  initialSchema,
  addArchivedAt,
  addNotebooks,
  addNoteFields,
  addManualTags,
  addTagColors,
  addLinks,
  addFts5Index,
  addLinkAnchors,
  addSyncFields,
  syncTracking,
  gitNotebooks,
};
