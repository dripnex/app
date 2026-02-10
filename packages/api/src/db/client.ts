/**
 * Database Client
 *
 * Creates a Drizzle client connected to Turso (libSQL).
 * SQLite-based, edge-native, and serverless.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

export type Env = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  SITE_URL?: string;
  ENVIRONMENT: string;
};

/**
 * Create database client from environment
 */
export function createDb(env: Env) {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
