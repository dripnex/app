const closableWindowIds = new Set<number>();

export function trackClosable(webContentsId: number): void {
  closableWindowIds.add(webContentsId);
}

export function forgetClosable(webContentsId: number): void {
  closableWindowIds.delete(webContentsId);
}

export function isClosable(webContentsId: number): boolean {
  return closableWindowIds.has(webContentsId);
}
