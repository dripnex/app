import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenseState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const licenseState = await window.readied.license.getState();
      setState(licenseState);
    } catch (error) {
      console.error('Failed to get license state:', error);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

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
