/**
 * First-run shell. Auth is optional (sync), never a hard gate on the editor.
 */

export type AppShell = 'welcome' | 'workspace';

export interface AppShellInput {
  onboardingComplete: boolean;
  /** Ignored. Missing session must not change the shell. */
  isAuthenticated?: boolean;
  sessionHydrated?: boolean;
}

/**
 * Welcome on first launch, then the workspace. Sign-in is Settings / Enable Sync.
 */
export function resolveAppShell(input: AppShellInput): AppShell {
  return input.onboardingComplete ? 'workspace' : 'welcome';
}
