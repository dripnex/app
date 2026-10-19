export type UpdaterBannerKind =
  | 'hidden'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'download-error'
  | 'install-error';

/** ShipIt failures must retry install, not download. */
export function updaterBannerErrorKind(
  prev: UpdaterBannerKind
): 'download-error' | 'install-error' {
  if (prev === 'ready' || prev === 'install-error') return 'install-error';
  return 'download-error';
}
