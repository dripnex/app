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

/** All migrations in order */
export const allMigrations: Migration[] = [
  initialSchema,
  addArchivedAt,
  addNotebooks,
  addNoteFields,
  addManualTags,
  addTagColors,
  addLinks,
];

export {
  initialSchema,
  addArchivedAt,
  addNotebooks,
  addNoteFields,
  addManualTags,
  addTagColors,
  addLinks,
};
