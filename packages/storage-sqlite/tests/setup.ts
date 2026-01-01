import { beforeAll } from 'vitest';

beforeAll(() => {
  try {
    // Intenta cargar better-sqlite3
    require('better-sqlite3');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    if (
      msg.includes('was compiled against a different Node.js version') ||
      msg.includes('NODE_MODULE_VERSION') ||
      msg.includes('Electron')
    ) {
      console.error('\n');
      console.error('═'.repeat(60));
      console.error('⚠️  TESTS SKIPPED: better-sqlite3 compiled for Electron');
      console.error('═'.repeat(60));
      console.error('');
      console.error('Los tests de storage-sqlite requieren better-sqlite3');
      console.error('compilado para Node.js, pero el binario actual está');
      console.error('compilado para Electron.');
      console.error('');
      console.error('Esto es esperado después de "pnpm dev" o "pnpm build".');
      console.error('Para ejecutar estos tests:');
      console.error('  1. cd packages/storage-sqlite');
      console.error('  2. pnpm rebuild better-sqlite3');
      console.error('  3. pnpm test');
      console.error('');
      console.error('NOTA: Después de esto, la app de Electron NO funcionará');
      console.error('hasta que ejecutes "pnpm dev" nuevamente.');
      console.error('═'.repeat(60));
      console.error('\n');

      process.exit(0); // Exit cleanly, not as failure
    }

    throw error; // Re-throw other errors
  }
});
