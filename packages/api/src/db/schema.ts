/**
 * Database Schema for Readied API
 *
 * Uses Drizzle ORM with Neon Postgres serverless.
 * Tables:
 * - users: User accounts with magic link auth
 * - devices: Registered sync devices
 * - sync_log: Change log for sync operations
 * - subscriptions: Pro tier subscriptions
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Users table - core user accounts
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Magic links for passwordless auth
 */
export const magicLinks = pgTable(
  'magic_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_magic_links_token').on(table.token)]
);

/**
 * Devices - registered sync devices per user
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(), // Client-generated UUID
    name: text('name'), // e.g., "MacBook Pro", "iPhone 15"
    platform: text('platform'), // "darwin", "win32", "ios", "android"
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_devices_user_device').on(table.userId, table.deviceId)]
);

/**
 * Sync log - encrypted note changes
 * Stores encrypted data only, server never sees plaintext
 */
export const syncLog = pgTable(
  'sync_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noteId: text('note_id').notNull(), // Client's note ID
    version: integer('version').notNull(), // Monotonically increasing
    operation: text('operation').notNull(), // 'create' | 'update' | 'delete'
    encryptedData: text('encrypted_data'), // E2EE note content (null for deletes)
    deviceId: text('device_id').notNull(), // Which device made the change
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sync_log_user_version').on(table.userId, table.version),
    index('idx_sync_log_user_note').on(table.userId, table.noteId),
  ]
);

/**
 * Subscriptions - Pro tier tracking
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').notNull().default('inactive'), // 'active' | 'trialing' | 'canceled' | 'inactive'
  plan: text('plan').notNull().default('free'), // 'free' | 'pro'
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * User sync cursor - tracks last synced version per device
 */
export const syncCursors = pgTable(
  'sync_cursors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    lastSyncedVersion: integer('last_synced_version').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_sync_cursors_user_device').on(table.userId, table.deviceId)]
);

// Type exports for use in routes
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type SyncLogEntry = typeof syncLog.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
