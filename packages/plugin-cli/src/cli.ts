#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * dripnex-plugin CLI
 *
 * Scaffold and manage Dripnex plugins.
 *
 * Usage:
 *   dripnex-plugin init <name>          Create a new plugin project
 *   dripnex-plugin list                 List installed plugins
 *   dripnex-plugin install <spec>       Install from directory, archive, or owner/repo[@tag]
 *   dripnex-plugin uninstall <id>       Remove an installed plugin
 *   dripnex-plugin link [path]          Symlink a local plugin for development
 *   dripnex-plugin --help               Show this help message
 */

import { initPlugin } from './commands/init';
import { parseInitArgs } from './parseInitArgs';
import { listPlugins } from './commands/list';
import { installPlugin } from './commands/install';
import { uninstallPlugin } from './commands/uninstall';
import { linkPlugin } from './commands/link';
import { packPlugin } from './commands/pack';
import { publishPlugin } from './commands/publish';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'init': {
      try {
        const { name, type } = parseInitArgs(args.slice(1));
        if (!name) {
          console.error('Usage: dripnex-plugin init <name> [--type plugin|theme]');
          console.error('Example: dripnex-plugin init "My Plugin"');
          console.error('Example: dripnex-plugin init "Paper" --type theme');
          process.exit(1);
        }

        const dir = await initPlugin({ name, type });
        console.log(`${type === 'theme' ? 'Theme' : 'Plugin'} scaffolded at: ${dir}`);
        console.log('');
        if (type === 'theme') {
          console.log('Next steps:');
          console.log(`  cd ${dir}`);
          console.log('  edit theme.json');
          console.log(`  dripnex-plugin link`);
        } else {
          console.log('Next steps:');
          console.log(`  cd ${dir}`);
          console.log('  npm install');
          console.log('  npm run build');
          console.log('');
          console.log('Then install it with: dripnex-plugin install ' + dir);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      break;
    }

    case 'list':
    case 'ls':
      listPlugins();
      break;

    case 'install':
      await installPlugin(args[1] ?? '');
      break;

    case 'uninstall':
    case 'remove':
      await uninstallPlugin(args[1] ?? '');
      break;

    case 'link':
      linkPlugin(args[1] ?? '.');
      break;

    case 'pack':
      packPlugin(args[1] ?? '.');
      break;

    case 'publish':
      await publishPlugin(args[1] ?? '.');
      break;

    case '--help':
    case '-h':
    case undefined:
      console.log('dripnex-plugin — Scaffold and manage Dripnex plugins');
      console.log('');
      console.log('Commands:');
      console.log('  init <name> [--type plugin|theme]   Create a plugin or a theme package');
      console.log('  list                 List installed plugins');
      console.log('  install <spec>       Install from directory, archive, or owner/repo[@tag]');
      console.log('  uninstall <id>       Remove an installed plugin');
      console.log('  link [path]          Symlink a local plugin for development');
      console.log('  pack [path]          Build a versioned .tar.gz');
      console.log(
        '  publish [path]       Pack, GitHub-release, and register on the Dripnex registry'
      );
      console.log('');
      console.log('Examples:');
      console.log('  dripnex-plugin init "My Plugin"');
      console.log('  dripnex-plugin init "Paper" --type theme');
      console.log('  dripnex-plugin list');
      console.log('  dripnex-plugin install ./my-plugin');
      console.log('  dripnex-plugin install plugin-v1.0.0.tar.gz');
      console.log('  dripnex-plugin install stamp');
      console.log('  dripnex-plugin install dripnex/plugin-stamp@v0.1.0');
      console.log('  dripnex-plugin uninstall my-plugin');
      console.log('  dripnex-plugin link .');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "dripnex-plugin --help" for usage');
      process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
