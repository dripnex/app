import { existsSync } from 'fs';
import { join } from 'path';

export function resolveAppIconPath(): string | undefined {
  const candidates = [
    join(__dirname, '../../../resources/icon.png'),
    join(process.resourcesPath, 'icon.png'),
  ];
  return candidates.find(candidate => existsSync(candidate));
}

/** Runtime dock image. Must already be squircles — dock.setIcon does not mask. */
export function resolveDockIconPath(): string | undefined {
  const candidates = [
    join(__dirname, '../../../resources/icon-dock.png'),
    join(process.resourcesPath, 'icon-dock.png'),
    join(__dirname, '../../../resources/icon.png'),
    join(process.resourcesPath, 'icon.png'),
  ];
  return candidates.find(candidate => existsSync(candidate));
}
