import { describe, expect, it } from 'vitest';
import { resolveAppShell } from '../appShell';

describe('resolveAppShell', () => {
  it('opens Welcome on first run without an account', () => {
    expect(
      resolveAppShell({
        onboardingComplete: false,
        isAuthenticated: false,
        sessionHydrated: true,
      })
    ).toBe('welcome');
  });

  it('opens the workspace for a returning unsigned user', () => {
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: false,
        sessionHydrated: true,
      })
    ).toBe('workspace');
  });

  it('does not wait on a missing session before showing the workspace', () => {
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: false,
        sessionHydrated: false,
      })
    ).toBe('workspace');
  });

  it('does not swap Welcome or workspace for a signed-in session', () => {
    expect(
      resolveAppShell({
        onboardingComplete: false,
        isAuthenticated: true,
        sessionHydrated: true,
      })
    ).toBe('welcome');
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: true,
        sessionHydrated: true,
      })
    ).toBe('workspace');
  });
});
