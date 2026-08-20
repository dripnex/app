/**
 * Host-side hooks that init.js can reach without importing the desktop.
 * The renderer sets these once at startup.
 */

import { themeRegistryStore } from '../theme/themeRegistryStore';

type CommandDispatch = (id: string, payload?: Record<string, unknown>) => Promise<boolean>;
type NotifyType = 'success' | 'info' | 'warning' | 'error';

let commandDispatch: CommandDispatch | null = null;
let vimApi: unknown = null;
let notifyHost: ((type: NotifyType, message: string) => void) | null = null;
let themeActive: ((id: string | null) => boolean) | null = null;

export function setHostCommandDispatch(fn: CommandDispatch | null): void {
  commandDispatch = fn;
}

export function dispatchHostCommand(
  id: string,
  payload?: Record<string, unknown>
): Promise<boolean> {
  return commandDispatch ? commandDispatch(id, payload) : Promise.resolve(false);
}

export function setHostNotify(fn: ((type: NotifyType, message: string) => void) | null): void {
  notifyHost = fn;
}

export function hostNotify(type: NotifyType, message: string): void {
  notifyHost?.(type, message);
}

export function setHostVim(api: unknown): void {
  vimApi = api;
}

export function getHostVim(): unknown {
  return vimApi;
}

export function setHostThemeActive(fn: ((id: string | null) => boolean) | null): void {
  themeActive = fn;
}

/** Persist + apply a palette. Falls back to the in-memory registry. */
export function hostSetActiveTheme(id: string | null): boolean {
  if (themeActive) return themeActive(id);
  themeRegistryStore.getState().setActive(id);
  return id === null || themeRegistryStore.getState().activeThemeId === id;
}
