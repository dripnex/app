import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { manifestTemplate } from '../templates/manifest.json';
import { indexTemplate } from '../templates/index.ts';
import { tsconfigTemplate } from '../templates/tsconfig';
import { packageJsonTemplate } from '../templates/package.json';

/**
 * Convert a name like "My Cool Plugin" to "my-cool-plugin" (kebab-case)
 */
function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface InitOptions {
  name: string;
  dir?: string;
}

/**
 * Scaffold a new plugin project.
 *
 * Creates the following structure:
 * ```
 * <dir>/
 *   manifest.json
 *   package.json
 *   tsconfig.json
 *   src/
 *     index.ts
 * ```
 */
export async function initPlugin(options: InitOptions): Promise<string> {
  const id = toKebabCase(options.name);

  if (!id) {
    throw new Error('Plugin name is required and must contain at least one letter or digit');
  }

  const targetDir = options.dir ?? join(process.cwd(), id);

  if (existsSync(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`);
  }

  // Create directory structure
  await mkdir(join(targetDir, 'src'), { recursive: true });

  // Write files
  await Promise.all([
    writeFile(join(targetDir, 'manifest.json'), manifestTemplate(id, options.name)),
    writeFile(join(targetDir, 'package.json'), packageJsonTemplate(id, options.name)),
    writeFile(join(targetDir, 'tsconfig.json'), tsconfigTemplate()),
    writeFile(join(targetDir, 'src', 'index.ts'), indexTemplate(id, options.name)),
  ]);

  return targetDir;
}
