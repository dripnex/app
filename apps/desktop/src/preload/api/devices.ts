import { ipcRenderer } from 'electron';

export interface DevicesAPI {
  list: () => Promise<
    Array<{
      id: string;
      deviceId: string;
      name: string | null;
      platform: string | null;
      isCurrent: boolean;
      lastSeenAt: string;
      createdAt: string;
    }>
  >;
  rename: (deviceId: string, name: string) => Promise<{ success: boolean; error?: string }>;
  revoke: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
  revokeOthers: () => Promise<{ success: boolean; revokedCount?: number; error?: string }>;
  getCurrent: () => Promise<{
    id: string;
    deviceId: string;
    name: string | null;
    platform: string | null;
    isCurrent: boolean;
    lastSeenAt: string;
    createdAt: string;
  } | null>;
}

export function createDevicesApi(): DevicesAPI {
  return {
    list: () => ipcRenderer.invoke('devices:list'),
    rename: (deviceId: string, name: string) =>
      ipcRenderer.invoke('devices:rename', deviceId, name),
    revoke: (deviceId: string) => ipcRenderer.invoke('devices:revoke', deviceId),
    revokeOthers: () => ipcRenderer.invoke('devices:revokeOthers'),
    getCurrent: () => ipcRenderer.invoke('devices:getCurrent'),
  };
}
