import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { manifestTemplate } from '../templates/manifest.json';
import { indexTemplate } from '../templates/index.ts';
import { tsconfigTemplate } from '../templates/tsconfig';
import { packageJsonTemplate } from '../templates/package.json';
import { keymapsTemplate } from '../templates/keymaps.default.json';
import { menusTemplate } from '../templates/menus.main.json';
import { stylesTemplate } from '../templates/styles.index.css';

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
 *   keymaps/default.json
 *   menus/main.json
 *   styles/index.css
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

  await mkdir(join(targetDir, 'src'), { recursive: true });
  await mkdir(join(targetDir, 'keymaps'), { recursive: true });
  await mkdir(join(targetDir, 'menus'), { recursive: true });
  await mkdir(join(targetDir, 'styles'), { recursive: true });

  await Promise.all([
    writeFile(join(targetDir, 'manifest.json'), manifestTemplate(id, options.name)),
    writeFile(join(targetDir, 'package.json'), packageJsonTemplate(id, options.name)),
    writeFile(join(targetDir, 'tsconfig.json'), tsconfigTemplate()),
    writeFile(join(targetDir, 'src', 'index.ts'), indexTemplate(id, options.name)),
    writeFile(join(targetDir, 'keymaps', 'default.json'), keymapsTemplate(id)),
    writeFile(join(targetDir, 'menus', 'main.json'), menusTemplate(id)),
    writeFile(join(targetDir, 'styles', 'index.css'), stylesTemplate()),
  ]);

  return targetDir;
}
