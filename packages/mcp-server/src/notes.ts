import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countWords, extractTitle } from '@dripnex/core';

export { countWords, extractTitle };

export const EXTERNAL_WRITE_FILENAME = 'dripnex.external-write';

export function markExternalWrite(dbPath: string): void {
  if (!dbPath || dbPath === ':memory:') return;
  writeFileSync(join(dirname(dbPath), EXTERNAL_WRITE_FILENAME), `${Date.now()}\n`);
}

export function readPackageVersion(packageJsonDir: string): string {
  try {
    const raw = readFileSync(join(packageJsonDir, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function packageDirFromModuleUrl(moduleUrl: string): string {
  return join(dirname(fileURLToPath(moduleUrl)), '..');
}
