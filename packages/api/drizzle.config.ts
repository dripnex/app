import { defineConfig } from 'drizzle-kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables from .dev.vars.local (priority) or .dev.vars (fallback)
const devVarsPath = existsSync(join(process.cwd(), '.dev.vars.local'))
  ? join(process.cwd(), '.dev.vars.local')
  : join(process.cwd(), '.dev.vars');

try {
  const devVars = readFileSync(devVarsPath, 'utf-8');
  devVars.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      // Remove surrounding quotes if present
      let value = valueParts.join('=').trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (_error) {
  // .dev.vars files not found, will use existing environment variables
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
