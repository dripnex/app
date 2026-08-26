import { useEffect } from 'react';
import { applySignedOut, useAuthStore } from '../stores/authStore';

function authVerifyToken(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (!value || typeof value !== 'object') return null;
  const rec = value as { kind?: unknown; token?: unknown };
  if (rec.kind === 'auth-verify' && typeof rec.token === 'string' && rec.token.length > 0) {
    return rec.token;
  }
  return null;
}

function consumeToken(token: string): void {
  void useAuthStore
    .getState()
    .verifyToken(token)
    .catch(error => {
      console.error('Deep link auth verification failed:', error);
    });
}

/**
 * Settings is a separate renderer from the main window.
 * Sign Out must clear that shell too, and AuthGate must consume magic-link
 * tokens even before SignedInApp (and useDeepLinks) mounts.
 */
export function useAuthSessionEvents(options?: { consumeMagicLink?: boolean }): void {
  const consumeMagicLink = options?.consumeMagicLink === true;

  useEffect(() => {
    const ipc = window.dripnex?.ipc;
    if (!ipc?.on) return;

    const offSignedOut = ipc.on('auth:signed-out', () => {
      applySignedOut();
    });

    if (!consumeMagicLink) {
      return () => {
        offSignedOut();
      };
    }

    const offVerify = ipc.on('auth:verify-token', (...args: unknown[]) => {
      const token = authVerifyToken(args[0]);
      if (token) consumeToken(token);
    });

    const onLocal = (event: Event) => {
      const token = authVerifyToken((event as CustomEvent).detail);
      if (token) consumeToken(token);
    };
    window.addEventListener('dripnex:open', onLocal);

    return () => {
      offSignedOut();
      offVerify();
      window.removeEventListener('dripnex:open', onLocal);
    };
  }, [consumeMagicLink]);
}
