/**
 * All migrations in order
 */

import type { Migration } from './runner.js';
import { initialSchema } from './001_initial_schema.js';
import { addArchivedAt } from './002_add_archived_at.js';

/** All available migrations */
export const allMigrations: Migration[] = [
  initialSchema,
  addArchivedAt,
];

export * from './runner.js';
