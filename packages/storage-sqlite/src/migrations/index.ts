/**
 * Migration exports
 */

import type { Migration } from '@readied/storage-core';
import { initialSchema } from './001_initial_schema.js';
import { addArchivedAt } from './002_add_archived_at.js';

/** All migrations in order */
export const allMigrations: Migration[] = [initialSchema, addArchivedAt];

export { initialSchema, addArchivedAt };
