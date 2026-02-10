/**
 * Add git support to notebooks
 *
 * Enables optional git version control per notebook.
 * Each git-enabled notebook becomes a git repository with full history.
 */

import type { Migration } from '@readied/storage-core';

export const gitNotebooks: Migration = {
  version: 20260109000009,
  name: 'git_notebooks',
  up: `
    -- Add git_enabled flag (default: disabled)
    -- 1 = notebook is a git repository with version control
    -- 0 = regular notebook without git
    ALTER TABLE notebooks ADD COLUMN git_enabled INTEGER DEFAULT 0;

    -- Add git_auto_commit flag (default: disabled)
    -- 1 = auto-commit on every note save
    -- 0 = manual commits only
    ALTER TABLE notebooks ADD COLUMN git_auto_commit INTEGER DEFAULT 0;

    -- Add git_initialized_at timestamp
    -- ISO 8601 timestamp when git was enabled for this notebook
    -- NULL = git not enabled or not yet initialized
    ALTER TABLE notebooks ADD COLUMN git_initialized_at TEXT DEFAULT NULL;

    -- Index for querying git-enabled notebooks
    CREATE INDEX IF NOT EXISTS idx_notebooks_git_enabled ON notebooks(git_enabled) WHERE git_enabled = 1;
  `,
};
