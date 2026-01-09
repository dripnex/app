/**
 * Database Schema for Readied API
 *
 * Uses Drizzle ORM with Turso (libSQL/SQLite).
 * Tables:
 * - users: User accounts with magic link auth
 * - devices: Registered sync devices
 * - sync_log: Change log for sync operations
 * - subscriptions: Pro tier subscriptions
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Users table - core user accounts
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

/**
 * Magic links for passwordless auth
 */
export const magicLinks = sqliteTable(
  'magic_links',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index('idx_magic_links_token').on(table.token)]
);

/**
 * Devices - registered sync devices per user
 */
export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(), // Client-generated UUID
    name: text('name'), // e.g., "MacBook Pro", "iPhone 15"
    platform: text('platform'), // "darwin", "win32", "ios", "android"
    lastSeenAt: text('last_seen_at').notNull().$defaultFn(() => new Date().toISOString()),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('idx_devices_user_device').on(table.userId, table.deviceId),
    uniqueIndex('idx_devices_unique').on(table.userId, table.deviceId),
  ]
);

/**
 * Sync log - encrypted note changes
 * Stores encrypted data only, server never sees plaintext
 */
export const syncLog = sqliteTable(
  'sync_log',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noteId: text('note_id').notNull(), // Client's note ID
    version: integer('version').notNull(), // Monotonically increasing
    operation: text('operation').notNull(), // 'create' | 'update' | 'delete'
    encryptedData: text('encrypted_data'), // E2EE note content (null for deletes)
    deviceId: text('device_id').notNull(), // Which device made the change
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('idx_sync_log_user_version').on(table.userId, table.version),
    index('idx_sync_log_user_note').on(table.userId, table.noteId),
  ]
);

/**
 * Subscriptions - Pro tier tracking
 */
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').notNull().default('inactive'), // 'active' | 'trialing' | 'canceled' | 'inactive'
  plan: text('plan').notNull().default('free'), // 'free' | 'pro'
  trialEndsAt: text('trial_ends_at'),
  currentPeriodEnd: text('current_period_end'),
  canceledAt: text('canceled_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

/**
 * User sync cursor - tracks last synced version per device
 */
export const syncCursors = sqliteTable(
  'sync_cursors',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    lastSyncedVersion: integer('last_synced_version').notNull().default(0),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('idx_sync_cursors_user_device').on(table.userId, table.deviceId),
    uniqueIndex('idx_sync_cursors_unique').on(table.userId, table.deviceId),
  ]
);

// Type exports for use in routes
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type SyncLogEntry = typeof syncLog.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
