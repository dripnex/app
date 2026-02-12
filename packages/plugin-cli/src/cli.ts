#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * readied-plugin CLI
 *
 * Scaffold and manage Readied plugins.
 *
 * Usage:
 *   readied-plugin init <name>     Create a new plugin project
 *   readied-plugin --help          Show this help message
 */

import { initPlugin } from './commands/init';

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
        console.log('Then copy the plugin folder to your Readied plugins directory.');
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      break;
    }

    case '--help':
    case '-h':
    case undefined:
      console.log('readied-plugin — Scaffold and manage Readied plugins');
      console.log('');
      console.log('Commands:');
      console.log('  init <name>    Create a new plugin project');
      console.log('');
      console.log('Examples:');
      console.log('  readied-plugin init "My Plugin"');
      console.log('  readied-plugin init word-counter');
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
