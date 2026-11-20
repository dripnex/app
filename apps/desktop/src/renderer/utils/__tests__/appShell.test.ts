import { describe, expect, it } from 'vitest';
import { resolveAppShell } from '../appShell';

describe('resolveAppShell', () => {
  it('shows Welcome on first run without an account', () => {
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

  it('does not wait on session hydration to open the workspace', () => {
    expect(
      resolveAppShell({
        onboardingComplete: true,
        isAuthenticated: false,
        sessionHydrated: false,
      })
    ).toBe('workspace');
  });

  it('shows Welcome on first run even when a session exists', () => {
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

  it('opens the same shell in Playwright as in production', () => {
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
