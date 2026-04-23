import { ipcRenderer } from 'electron';
import type { User } from './types';

export interface AuthAPI {
  requestMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyToken: (token: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  getSession: () => Promise<{ user: User } | null>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  refreshToken: () => Promise<{ success: boolean }>;
}

export function createAuthApi(): AuthAPI {
  return {
    requestMagicLink: email => ipcRenderer.invoke('auth:requestMagicLink', email),
    verifyToken: token => ipcRenderer.invoke('auth:verify', token),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    refreshToken: () => ipcRenderer.invoke('auth:refreshToken'),
  };
}
