import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { DripnexDeepLink } from '../utils/parseDripnexUrl';
import { dispatchCommand } from './useCommandRegistry';
import { useNavigationActions } from './useNavigation';

function isDeepLink(value: unknown): value is DripnexDeepLink {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'auth-verify' || kind === 'note' || kind === 'notebook' || kind === 'tag';
}

/**
 * `dripnex://` URIs from the OS, a second instance, or in-app preview links.
 */
export function useDeepLinks() {
  const { goToNotebook, goToTag } = useNavigationActions();

  useEffect(() => {
    const apply = (link: DripnexDeepLink) => {
      if (link.kind === 'auth-verify') {
        void useAuthStore
          .getState()
          .verifyToken(link.token)
          .catch(error => {
            console.error('Deep link auth verification failed:', error);
          });
        return;
      }
      if (link.kind === 'note') {
        void dispatchCommand('app:open-note', {
          noteId: link.noteId,
          ...(link.heading ? { heading: link.heading } : {}),
        });
        return;
      }
      if (link.kind === 'notebook') {
        goToNotebook(link.notebookId);
        return;
      }
      goToTag(link.tag);
    };

    const onIpc = (...args: unknown[]) => {
      const payload = args[0];
      // Auth still arrives on `auth:verify-token` so we do not verify twice.
      if (isDeepLink(payload) && payload.kind !== 'auth-verify') apply(payload);
    };

    const onLocal = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (isDeepLink(detail)) apply(detail);
    };

    const offIpc = window.dripnex.ipc.on('app:deep-link', onIpc);
    const offAuth = window.dripnex.ipc.on('auth:verify-token', (...args: unknown[]) => {
      const token = typeof args[0] === 'string' ? args[0] : '';
      if (token) apply({ kind: 'auth-verify', token });
    });
    window.addEventListener('dripnex:open', onLocal);

    return () => {
      offIpc();
      offAuth();
      window.removeEventListener('dripnex:open', onLocal);
    };
  }, [goToNotebook, goToTag]);
}
