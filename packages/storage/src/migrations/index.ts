/**
 * All migrations in order
 */

import type { Migration } from './runner.js';
import { initialSchema } from './001_initial_schema.js';

/** All available migrations */
export const allMigrations: Migration[] = [
  initialSchema,
];

export * from './runner.js';
