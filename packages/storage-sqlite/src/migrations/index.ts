/**
 * Migration exports
 */

import type { Migration } from '@readied/storage-core';
import { initialSchema } from './001_initial_schema.js';
import { addArchivedAt } from './002_add_archived_at.js';
import { addNotebooks } from './003_notebooks.js';
import { addNoteFields } from './004_note_fields.js';

/** All migrations in order */
export const allMigrations: Migration[] = [
  initialSchema,
  addArchivedAt,
  addNotebooks,
  addNoteFields,
];

export { initialSchema, addArchivedAt, addNotebooks, addNoteFields };
