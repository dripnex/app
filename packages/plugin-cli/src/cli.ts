#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * readied-plugin CLI
 *
 * Scaffold and manage Readied plugins.
 *
 * Usage:
 *   readied-plugin init <name>          Create a new plugin project
 *   readied-plugin list                 List installed plugins
 *   readied-plugin install <path>       Install a plugin from directory or archive
 *   readied-plugin uninstall <id>       Remove an installed plugin
 *   readied-plugin link [path]          Symlink a local plugin for development
 *   readied-plugin --help               Show this help message
 */

import { initPlugin } from './commands/init';
import { listPlugins } from './commands/list';
import { installPlugin } from './commands/install';
import { uninstallPlugin } from './commands/uninstall';
import { linkPlugin } from './commands/link';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'init': {
      const name = args.slice(1).join(' ');
      if (!name) {
        console.error('Usage: readied-plugin init <plugin-name>');
        console.error('Example: readied-plugin init "My Plugin"');
        process.exit(1);
      }

      try {
        const dir = await initPlugin({ name });
        console.log(`Plugin scaffolded at: ${dir}`);
        console.log('');
        console.log('Next steps:');
        console.log(`  cd ${dir}`);
        console.log('  npm install');
        console.log('  npm run build');
        console.log('');
        console.log('Then install it with: readied-plugin install ' + dir);
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
      installPlugin(args[1] ?? '');
      break;

    case 'uninstall':
    case 'remove':
      await uninstallPlugin(args[1] ?? '');
      break;

    case 'link':
      linkPlugin(args[1] ?? '.');
      break;

    case '--help':
    case '-h':
    case undefined:
      console.log('readied-plugin — Scaffold and manage Readied plugins');
      console.log('');
      console.log('Commands:');
      console.log('  init <name>          Create a new plugin project');
      console.log('  list                 List installed plugins');
      console.log('  install <path>       Install a plugin from directory or archive');
      console.log('  uninstall <id>       Remove an installed plugin');
      console.log('  link [path]          Symlink a local plugin for development');
      console.log('');
      console.log('Examples:');
      console.log('  readied-plugin init "My Plugin"');
      console.log('  readied-plugin list');
      console.log('  readied-plugin install ./my-plugin');
      console.log('  readied-plugin install plugin-v1.0.0.tar.gz');
      console.log('  readied-plugin uninstall my-plugin');
      console.log('  readied-plugin link .');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "readied-plugin --help" for usage');
      process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
