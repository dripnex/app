/**
 * NotebookGitSettingsRepository
 *
 * Per-notebook git integration settings (enable/disable, auto-commit).
 * Separate port from core's NotebookRepository because it's a desktop-only
 * feature, not a core notebook concern.
 */

import type { Notebook, NotebookId } from '@dripnex/core';

export interface NotebookGitSettings {
  enabled: boolean;
  autoCommit: boolean;
  initializedAt: string | null;
}

export interface NotebookGitSettingsRepository {
  enableGit(notebookId: NotebookId): void;
  disableGit(notebookId: NotebookId): void;
  isGitEnabled(notebookId: NotebookId): boolean;
  getGitSettings(notebookId: NotebookId): NotebookGitSettings | null;
  setGitAutoCommit(notebookId: NotebookId, enabled: boolean): void;
  getGitEnabledNotebooks(): Notebook[];
}
