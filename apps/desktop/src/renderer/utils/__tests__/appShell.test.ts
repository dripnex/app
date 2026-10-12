import { describe, expect, it } from 'vitest';
import { resolveAppShell } from '../appShell';

describe('resolveAppShell', () => {
  it('shows AuthGate on first run without an account', () => {
    expect(
      resolveAppShell({
        onboardingComplete: false,
        isAuthenticated: false,
        sessionHydrated: true,
      })
    ).toBe('auth');
  });

  it('shows AuthGate for a returning unsigned user', () => {
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: false,
        sessionHydrated: true,
      })
    ).toBe('auth');
  });

  it('waits on AuthGate until the session hydrates', () => {
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: false,
        sessionHydrated: false,
      })
    ).toBe('auth');
  });

  it('shows Welcome after account on first run', () => {
    expect(
      resolveAppShell({
        onboardingComplete: false,
        isAuthenticated: true,
        sessionHydrated: true,
      })
    ).toBe('welcome');
  });

  it('shows the workspace for a signed-in returning user', () => {
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: true,
        sessionHydrated: true,
      })
    ).toBe('workspace');
  });

  it('lets Playwright skip AuthGate without becoming a production bypass', () => {
    expect(
      resolveAppShell({
        onboardingComplete: false,
        isAuthenticated: false,
        sessionHydrated: false,
        isE2E: true,
      })
    ).toBe('welcome');
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: false,
        sessionHydrated: false,
        isE2E: true,
      })
    ).toBe('workspace');
  });
});
