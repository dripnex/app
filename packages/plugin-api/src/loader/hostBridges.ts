/**
 * Host-side hooks that init.js can reach without importing the desktop.
 * The renderer sets these once at startup.
 */

let commandDispatch: ((id: string) => Promise<boolean>) | null = null;
let vimApi: unknown = null;

export function setHostCommandDispatch(fn: ((id: string) => Promise<boolean>) | null): void {
  commandDispatch = fn;
}

export function dispatchHostCommand(id: string): Promise<boolean> {
  return commandDispatch ? commandDispatch(id) : Promise.resolve(false);
}

export function setHostVim(api: unknown): void {
  vimApi = api;
}

export function getHostVim(): unknown {
  return vimApi;
}
