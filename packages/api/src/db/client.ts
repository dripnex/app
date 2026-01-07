/**
 * Database Client
 *
 * Creates a Drizzle client connected to Neon Postgres.
 * Uses serverless driver for edge runtime compatibility.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ENVIRONMENT: string;
};

/**
 * Create database client from environment
 */
export function createDb(env: Env) {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
