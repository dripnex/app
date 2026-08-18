import { execFile } from 'child_process';
import { readdir } from 'fs/promises';
import { join, normalize, sep } from 'path';

/** True when an archive member cannot write outside the extract root. */
export function isSafeArchiveEntry(entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return false;
  return !trimmed.split(/[/\\]/).includes('..');
}

export function listArchiveEntries(archivePath: string): Promise<string[]> {
  const isZip = archivePath.toLowerCase().endsWith('.zip');
  return new Promise((resolve, reject) => {
    const cmd = isZip ? 'unzip' : 'tar';
    const args = isZip ? ['-Z1', archivePath] : ['-t', '-z', '-f', archivePath];
    execFile(cmd, args, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(
        stdout
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
      );
    });
  });
}

export async function extractArchiveSafely(archivePath: string, destDir: string): Promise<void> {
  const entries = await listArchiveEntries(archivePath);
  const unsafe = entries.find(entry => !isSafeArchiveEntry(entry));
  if (unsafe) {
    throw new Error(`Unsafe archive path: ${unsafe}`);
  }
  await extractArchive(archivePath, destDir);
  await assertExtractStayedInside(destDir);
}

export function extractArchive(archivePath: string, destDir: string): Promise<void> {
  const isZip = archivePath.toLowerCase().endsWith('.zip');
  return new Promise((resolve, reject) => {
    const cb = (error: Error | null) => {
      if (error) reject(error);
      else resolve();
    };
    if (isZip) {
      if (process.platform === 'win32') {
        execFile(
          'powershell',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            'Expand-Archive',
            '-Force',
            '-Path',
            archivePath,
            '-DestinationPath',
            destDir,
          ],
          cb
        );
      } else {
        execFile('unzip', ['-o', archivePath, '-d', destDir], cb);
      }
    } else {
      execFile('tar', ['-x', '-z', '-f', archivePath, '-C', destDir], cb);
    }
  });
}

export async function assertExtractStayedInside(root: string): Promise<void> {
  const rootNorm = normalize(root);
  const prefix = rootNorm.endsWith(sep) ? rootNorm : rootNorm + sep;

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const norm = normalize(full);
      if (norm !== rootNorm && !norm.startsWith(prefix)) {
        throw new Error('Archive escaped extract directory');
      }
      if (entry.isSymbolicLink()) {
        throw new Error('Archive contains a symlink');
      }
      if (entry.isDirectory()) {
        await walk(full);
      }
    }
  }

  await walk(root);
}
