import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

/**
 * Handles deep link auth verification events (dripnex://auth/verify?token=xxx).
 * Listens for IPC 'auth:verify-token' events and verifies the token via authStore.
 */
export function useDeepLinks() {
  useEffect(() => {
    const handleAuthVerification = async (...args: unknown[]) => {
      const token = args[0] as string;
      if (!token) return;

      try {
        await useAuthStore.getState().verifyToken(token);
      } catch (error) {
        console.error('Deep link auth verification failed:', error);
      }
    };

    // Listen for deep link auth verification events
    const removeListener = window.dripnex.ipc.on('auth:verify-token', handleAuthVerification);

    return () => {
      removeListener();
    };
  }, []);
}
