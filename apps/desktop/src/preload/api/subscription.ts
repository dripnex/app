import { ipcRenderer } from 'electron';
import type { SubscriptionStatus, LicenseState, LicenseResult } from './types';

export interface SubscriptionAPI {
  getStatus: () => Promise<{
    success: boolean;
    status?: SubscriptionStatus;
    error?: string;
  }>;
  openPortal: (returnUrl: string) => Promise<{ success: boolean; error?: string }>;
  openCheckout: () => Promise<{ success: boolean; error?: string }>;
}

export interface LicenseAPI {
  getState: () => Promise<LicenseState>;
  refreshSubscription: () => Promise<LicenseState>;
  startTrial: () => Promise<{ success: boolean; error?: string }>;
  openSubscribe: (options?: {
    plan?: 'monthly' | 'annual';
  }) => Promise<{ success: boolean; error?: string }>;
  activate: (content: string) => Promise<LicenseResult>;
  importFile: () => Promise<LicenseResult>;
  deactivate: () => Promise<{ success: boolean }>;
}

export function createSubscriptionApi(): SubscriptionAPI {
  return {
    getStatus: () => ipcRenderer.invoke('subscription:getStatus'),
    openPortal: returnUrl => ipcRenderer.invoke('subscription:openPortal', returnUrl),
    openCheckout: () => ipcRenderer.invoke('subscription:openCheckout'),
  };
}

export function createLicenseApi(): LicenseAPI {
  return {
    getState: () => ipcRenderer.invoke('license:getState'),
    refreshSubscription: () => ipcRenderer.invoke('license:refreshSubscription'),
    startTrial: () => ipcRenderer.invoke('license:startTrial'),
    openSubscribe: options => ipcRenderer.invoke('license:openSubscribe', options),
    activate: content => ipcRenderer.invoke('license:activate', content),
    importFile: () => ipcRenderer.invoke('license:importFile'),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
  };
}
