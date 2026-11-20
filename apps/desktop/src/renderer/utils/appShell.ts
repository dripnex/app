/**
 * Launch shell. The workspace opens without an account.
 * Sign-in is only for cloud sync. Session hydration must not block local notes.
 */

export type AppShell = 'auth' | 'welcome' | 'workspace';

export interface AppShellInput {
  onboardingComplete: boolean;
  /** Ignored. A session does not choose the shell. */
  isAuthenticated?: boolean;
  /** Ignored. Hydration must not block the workspace. */
  sessionHydrated?: boolean;
  /** Ignored. Playwright no longer needs a bypass to open the workspace. */
  isE2E?: boolean;
}

/**
 * First run → Welcome. After that → workspace, signed in or not.
 */
export function resolveAppShell(input: AppShellInput): AppShell {
  return input.onboardingComplete ? 'workspace' : 'welcome';
}
