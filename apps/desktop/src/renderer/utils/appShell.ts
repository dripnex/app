/**
 * Launch shell. AuthGate is the first window.
 * Playwright may set isE2E so automated tests skip the gate — not a production bypass.
 */

export type AppShell = 'auth' | 'welcome' | 'workspace';

export interface AppShellInput {
  onboardingComplete: boolean;
  isAuthenticated?: boolean;
  sessionHydrated?: boolean;
  /** Playwright-only. Must never be true in a production build. */
  isE2E?: boolean;
}

/**
 * No session → AuthGate. After account: Welcome (first run) or workspace.
 */
export function resolveAppShell(input: AppShellInput): AppShell {
  const skipAuth = input.isE2E === true;
  if (!skipAuth && (!input.sessionHydrated || !input.isAuthenticated)) {
    return 'auth';
  }
  return input.onboardingComplete ? 'workspace' : 'welcome';
}
