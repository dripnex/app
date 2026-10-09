import { statfsSync } from 'fs';

/** ShipIt unpacks the zip next to a second copy of the app. Zip is ~180 MB. */
export const UPDATE_INSTALL_FREE_BYTES = 1024 * 1024 * 1024;

export function freeBytesAt(path: string): number {
  const stats = statfsSync(path);
  return Number(stats.bavail) * Number(stats.bsize);
}

export function formatUpdaterError(message: string): string {
  if (/no space left on device/i.test(message) || /\bENOSPC\b/i.test(message)) {
    return 'Not enough disk space to install the update. Free about 1 GB and try again.';
  }
  if (/pkzip signature/i.test(message)) {
    return 'The downloaded update is incomplete. Download it again.';
  }
  return message;
}

export function notEnoughSpaceMessage(free: number): string {
  const mb = Math.max(0, Math.round(free / (1024 * 1024)));
  return `Not enough disk space to install the update (${mb} MB free). Free about 1 GB and try again.`;
}
