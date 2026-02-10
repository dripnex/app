import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { LicenseState, LicenseResult } from '../../preload/index';

interface LicenseContextValue {
  state: LicenseState | null;
  isLoading: boolean;
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  activateLicense: (content: string) => Promise<LicenseResult>;
  importLicense: () => Promise<LicenseResult>;
  deactivateLicense: () => Promise<void>;
  openSubscribe: (options?: {
    plan?: 'monthly' | 'annual';
  }) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenseState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const licenseState = await window.readied.license.getState();
      setState(licenseState);
    } catch (error) {
      window.readied.log.error('Failed to get license state', { error: String(error) });
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
    return stopPolling;
  }, [refresh, stopPolling]);

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const activateLicense = useCallback(
    async (content: string): Promise<LicenseResult> => {
      const result = await window.readied.license.activate(content);
      if (result.success) {
        await refresh();
        setIsDialogOpen(false);
      }
      return result;
    },
    [refresh]
  );

  const importLicense = useCallback(async (): Promise<LicenseResult> => {
    const result = await window.readied.license.importFile();
    if (result.success) {
      await refresh();
      setIsDialogOpen(false);
    }
    return result;
  }, [refresh]);

  const deactivateLicense = useCallback(async () => {
    await window.readied.license.deactivate();
    await refresh();
  }, [refresh]);

  const openSubscribe = useCallback(
    async (options?: { plan?: 'monthly' | 'annual' }) => {
      try {
        const result = await window.readied.license.openSubscribe(options);
        if (result.success) {
          // Poll every 5s for up to 2 minutes waiting for webhook to update the API
          stopPolling();
          let attempts = 0;
          const maxAttempts = 24; // 2 minutes at 5s intervals
          pollRef.current = setInterval(async () => {
            attempts++;
            try {
              const newState = await window.readied.license.refreshSubscription();
              if (newState.status === 'pro_active' || attempts >= maxAttempts) {
                stopPolling();
                setState(newState);
              }
            } catch {
              // Ignore errors during polling
              if (attempts >= maxAttempts) {
                stopPolling();
              }
            }
          }, 5000);
        }
        return result;
      } catch (error) {
        window.readied.log.error('Failed to open subscription', { error: String(error) });
        return { success: false, error: 'Failed to open subscription checkout' };
      }
    },
    [stopPolling]
  );

  return (
    <LicenseContext.Provider
      value={{
        state,
        isLoading,
        isDialogOpen,
        openDialog,
        closeDialog,
        activateLicense,
        importLicense,
        deactivateLicense,
        openSubscribe,
        refresh,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
