import { registerGitHubHandlers } from './github/ipc.js';
import { registerOnePasswordHandlers } from './onepassword/ipc.js';
import type { GitHubNoteSink } from './github/service.js';

export interface IntegrationDeps {
  dataDir: string;
  getAppVersion: () => string;
  githubNotes?: GitHubNoteSink;
}

/** Optional third-party bridges. Core product IPC stays in handlers/. */
export function registerIntegrations(deps: IntegrationDeps): void {
  registerOnePasswordHandlers(deps);
  registerGitHubHandlers({ dataDir: deps.dataDir, notes: deps.githubNotes });
}
