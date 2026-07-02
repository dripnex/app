/**
 * Auth, Sync, Encryption, Subscription, and Device IPC Handlers
 *
 * Handles authentication (magic link), sync operations, E2EE key management,
 * subscription/billing, and device management.
 */

import { shell } from 'electron';
import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import type {
  ApiClient,
  EncryptionService,
  SyncService,
  TokenStorage,
  BroadcastFn,
} from './types.js';

export interface AuthSyncHandlerDeps {
  apiClient: ApiClient;
  tokenStorage: TokenStorage;
  syncService: SyncService;
  encryptionService: EncryptionService | null;
  broadcastToWindows: BroadcastFn;
}

const EmailSchema = z.string().email().max(254);
const TokenSchema = z.string().min(1).max(2048);
const PassphraseSchema = z.string().min(1).max(1024);
const RecoveryKeySchema = z.string().min(8).max(512);
const IdSchema = z.string().min(1).max(128);
const NameSchema = z.string().min(1).max(128);
const KeyHexSchema = z
  .string()
  .min(32)
  .max(256)
  .regex(/^[a-f0-9]+$/i);
const UrlSchema = z.string().url().max(2048);

const SyncChangeSchema = z.object({
  noteId: IdSchema,
  operation: z.enum(['create', 'update', 'delete']),
  content: z
    .string()
    .max(10 * 1024 * 1024)
    .optional(),
  localVersion: z.number().int().nonnegative().optional(),
});

export function registerAuthSyncHandlers(deps: AuthSyncHandlerDeps): void {
  const {
    apiClient: client,
    tokenStorage: storage,
    syncService: sync,
    encryptionService: encryption,
  } = deps;

  sync.onStatusChange(event => {
    deps.broadcastToWindows('sync:status-changed', event);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Authentication
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'auth:requestMagicLink',
    args: z.tuple([EmailSchema]),
    handler: async email => {
      try {
        await client.requestMagicLink(email);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to request magic link',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'auth:verify',
    args: z.tuple([TokenSchema]),
    handler: async token => {
      try {
        const result = await client.verifyMagicLink(token);
        await storage.saveTokens(result.accessToken, result.refreshToken);
        return { success: true, user: result.user };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to verify token',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'auth:getSession',
    args: z.tuple([]),
    handler: async () => {
      try {
        const hasTokens = await storage.hasTokens();
        if (!hasTokens) return null;
        const user = await client.getCurrentUser();
        return { user };
      } catch {
        await storage.clearTokens();
        return null;
      }
    },
  });

  defineIpcHandler({
    channel: 'auth:logout',
    args: z.tuple([]),
    handler: async () => {
      try {
        sync?.stopAutoSync();
        await storage.clearTokens();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to logout',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'auth:refreshToken',
    args: z.tuple([]),
    handler: async () => {
      try {
        const refreshed = await client.refreshAccessToken();
        return { success: refreshed };
      } catch {
        return { success: false };
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sync
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'sync:pull',
    args: z.tuple([]),
    handler: async () => {
      try {
        const result = await sync.pull();
        return {
          success: result.success,
          changes: result.changes,
          cursor: result.cursor,
          hasMore: result.hasMore,
          conflicts: result.conflicts,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to pull changes',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:push',
    args: z.tuple([z.array(SyncChangeSchema).max(100000)]),
    handler: async changes => {
      try {
        const result = await sync.push(changes);
        return { success: result.success, results: result.results, error: result.error };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to push changes',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:syncNow',
    args: z.tuple([]),
    handler: async () => {
      try {
        return await sync.syncNow();
      } catch (error) {
        return {
          success: false,
          changesApplied: 0,
          changesPushed: 0,
          conflicts: [],
          error: error instanceof Error ? error.message : 'Sync failed',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:status',
    args: z.tuple([]),
    handler: () => {
      try {
        const state = sync.getState();
        return {
          success: true,
          cursor: state.cursor,
          lastSyncAt: state.lastSyncAt,
          isSyncing: state.isSyncing,
          lastError: state.lastError,
          consecutiveFailures: state.consecutiveFailures,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get sync status',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:pendingCount',
    args: z.tuple([]),
    handler: () => {
      try {
        return { success: true, count: sync.getPendingCount() };
      } catch (error) {
        return {
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Failed',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:resolveConflict',
    args: z.tuple([IdSchema, z.enum(['local', 'remote'])]),
    handler: async (noteId, resolution) => {
      try {
        await sync.resolveConflict(noteId, resolution);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to resolve conflict',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:startAutoSync',
    args: z.tuple([
      z
        .number()
        .int()
        .min(1000)
        .max(24 * 60 * 60 * 1000)
        .optional(),
    ]),
    handler: intervalMs => {
      try {
        sync.startAutoSync(intervalMs);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start auto-sync',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:stopAutoSync',
    args: z.tuple([]),
    handler: () => {
      try {
        sync.stopAutoSync();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to stop auto-sync',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:pullTags',
    args: z.tuple([]),
    handler: async () => {
      try {
        return await sync.pullTags();
      } catch (error) {
        return { success: false, applied: 0, error: String(error) };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:pushTags',
    args: z.tuple([]),
    handler: async () => {
      try {
        return await sync.pushTags();
      } catch (error) {
        return { success: false, pushed: 0, error: String(error) };
      }
    },
  });

  defineIpcHandler({
    channel: 'sync:history',
    args: z.tuple([z.number().int().positive().max(10000).optional()]),
    handler: limit => {
      try {
        const history = sync.getSyncHistory(limit);
        return { success: true, history };
      } catch (error) {
        return {
          success: false,
          history: [],
          error: error instanceof Error ? error.message : 'Failed to get sync history',
        };
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // E2EE Key Management
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'encryption:isReady',
    args: z.tuple([]),
    handler: () => ({ ready: encryption?.isReady() ?? false }),
  });

  defineIpcHandler({
    channel: 'encryption:getKeyStatus',
    args: z.tuple([]),
    handler: async () => {
      try {
        const serverKeys = await client.getEncryptionKeys();
        const hasLocalKey = encryption?.isReady() ?? false;
        const hasLegacyKey = encryption?.hasLegacyKey() ?? false;
        return {
          success: true,
          hasServerKeys: serverKeys.exists,
          hasLocalKey,
          hasLegacyKey,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get key status',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'encryption:setupKeys',
    args: z.tuple([PassphraseSchema]),
    handler: async passphrase => {
      try {
        if (!encryption) throw new Error('Encryption service not available');
        const result = await encryption.setupKeys(passphrase);
        await client.setEncryptionKeys({
          salt: result.salt,
          wrappedCek: result.wrappedCek,
          wrappedCekRecovery: result.wrappedCekRecovery,
          kdfParams: result.kdfParams,
        });
        return { success: true, recoveryKey: result.recoveryKey };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to setup encryption keys',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'encryption:unlockWithPassphrase',
    args: z.tuple([PassphraseSchema]),
    handler: async passphrase => {
      try {
        if (!encryption) throw new Error('Encryption service not available');
        const serverKeys = await client.getEncryptionKeys();
        if (
          !serverKeys.exists ||
          !serverKeys.salt ||
          !serverKeys.wrappedCek ||
          !serverKeys.kdfParams
        ) {
          return { success: false, error: 'No encryption keys found on server' };
        }
        await encryption.unlockWithPassphrase(
          passphrase,
          serverKeys.salt,
          serverKeys.wrappedCek,
          serverKeys.kdfParams
        );
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to unlock';
        const isWrongPassphrase = msg.includes('incorrect passphrase') || msg.includes('unwrap');
        return {
          success: false,
          wrongPassphrase: isWrongPassphrase,
          error: isWrongPassphrase ? 'Incorrect passphrase' : msg,
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'encryption:unlockWithRecoveryKey',
    args: z.tuple([RecoveryKeySchema]),
    handler: async recoveryKey => {
      try {
        if (!encryption) throw new Error('Encryption service not available');
        const serverKeys = await client.getEncryptionKeys();
        if (!serverKeys.exists || !serverKeys.wrappedCekRecovery) {
          return { success: false, error: 'No recovery key found on server' };
        }
        await encryption.unlockWithRecoveryKey(recoveryKey, serverKeys.wrappedCekRecovery);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to unlock with recovery key',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'encryption:migrateLegacyKey',
    args: z.tuple([PassphraseSchema]),
    handler: async passphrase => {
      try {
        if (!encryption) throw new Error('Encryption service not available');
        const result = await encryption.migrateLegacyKey(passphrase);
        await client.setEncryptionKeys({
          salt: result.salt,
          wrappedCek: result.wrappedCek,
          wrappedCekRecovery: result.wrappedCekRecovery,
          kdfParams: result.kdfParams,
        });
        return { success: true, recoveryKey: result.recoveryKey };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to migrate legacy key',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'encryption:changePassphrase',
    args: z.tuple([PassphraseSchema]),
    handler: async newPassphrase => {
      try {
        if (!encryption) throw new Error('Encryption service not available');
        const result = await encryption.changePassphrase(newPassphrase);
        await client.setEncryptionKeys({
          salt: result.salt,
          wrappedCek: result.wrappedCek,
          kdfParams: result.kdfParams,
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to change passphrase',
        };
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Subscription
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'subscription:getStatus',
    args: z.tuple([]),
    handler: async () => {
      try {
        const status = await client.getSubscriptionStatus();
        return { success: true, status };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get subscription status',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'subscription:openPortal',
    args: z.tuple([UrlSchema]),
    handler: async returnUrl => {
      try {
        const { url } = await client.createPortalSession(returnUrl);
        void shell.openExternal(url);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open billing portal',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'subscription:openCheckout',
    args: z.tuple([]),
    handler: () => {
      try {
        void shell.openExternal('https://dripnex.app/pricing');
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open checkout',
        };
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Devices
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'devices:list',
    args: z.tuple([]),
    handler: async () => {
      try {
        const result = await client.listDevices();
        return result.devices;
      } catch {
        return [];
      }
    },
  });

  defineIpcHandler({
    channel: 'devices:rename',
    args: z.tuple([IdSchema, NameSchema]),
    handler: async (deviceId, name) => {
      try {
        await client.renameDevice(deviceId, name);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to rename device',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'devices:revoke',
    args: z.tuple([IdSchema]),
    handler: async deviceId => {
      try {
        await client.revokeDevice(deviceId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to revoke device',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'devices:revokeOthers',
    args: z.tuple([]),
    handler: async () => {
      try {
        const result = await client.revokeOtherDevices();
        return { success: true, revokedCount: result.revokedCount };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to revoke devices',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'devices:getCurrent',
    args: z.tuple([]),
    handler: async () => {
      try {
        const result = await client.listDevices();
        return result.devices.find(d => d.isCurrent) ?? null;
      } catch {
        return null;
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Encryption Key Management (export/import)
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'encryption:exportKey',
    args: z.tuple([]),
    handler: () => {
      try {
        if (!encryption) throw new Error('Encryption service not initialized');
        const keyHex = encryption.exportKey();
        return { success: true, key: keyHex };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to export encryption key',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'encryption:importKey',
    args: z.tuple([KeyHexSchema]),
    handler: async keyHex => {
      try {
        if (!encryption) throw new Error('Encryption service not initialized');
        await encryption.importKey(keyHex);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to import encryption key',
        };
      }
    },
  });
}
