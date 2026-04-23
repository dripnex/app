/**
 * Auth, Sync, Encryption, Subscription, and Device IPC Handlers
 *
 * Handles authentication (magic link), sync operations, E2EE key management,
 * subscription/billing, and device management.
 */

import { ipcMain, shell } from 'electron';
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

export function registerAuthSyncHandlers(deps: AuthSyncHandlerDeps): void {
  const {
    apiClient: client,
    tokenStorage: storage,
    syncService: sync,
    encryptionService: encryption,
  } = deps;

  // Broadcast sync status events to all renderer windows
  sync.onStatusChange(event => {
    deps.broadcastToWindows('sync:status-changed', event);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Authentication
  // ═══════════════════════════════════════════════════════════════════════════

  // Request magic link email
  ipcMain.handle('auth:requestMagicLink', async (_event, email: string) => {
    try {
      await client.requestMagicLink(email);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request magic link',
      };
    }
  });

  // Verify magic link token and save tokens
  ipcMain.handle('auth:verify', async (_event, token: string) => {
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
  });

  // Get current session
  ipcMain.handle('auth:getSession', async () => {
    try {
      const hasTokens = await storage.hasTokens();
      if (!hasTokens) {
        return null;
      }

      const user = await client.getCurrentUser();
      return { user };
    } catch (_error) {
      // If session is invalid, clear tokens
      await storage.clearTokens();
      return null;
    }
  });

  // Logout and clear tokens
  ipcMain.handle('auth:logout', async () => {
    try {
      // Abort any in-flight sync operations before clearing tokens
      sync?.stopAutoSync();
      await storage.clearTokens();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to logout',
      };
    }
  });

  // Refresh access token
  ipcMain.handle('auth:refreshToken', async () => {
    try {
      const refreshed = await client.refreshAccessToken();
      return { success: refreshed };
    } catch (_error) {
      return { success: false };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sync
  // ═══════════════════════════════════════════════════════════════════════════

  // Pull changes from server
  ipcMain.handle('sync:pull', async () => {
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
  });

  // Push changes to server
  ipcMain.handle(
    'sync:push',
    async (
      _event,
      changes: Array<{
        noteId: string;
        operation: 'create' | 'update' | 'delete';
        content?: string;
        localVersion?: number;
      }>
    ) => {
      try {
        const result = await sync.push(changes);
        return {
          success: result.success,
          results: result.results,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to push changes',
        };
      }
    }
  );

  // Perform full sync (pull + push)
  ipcMain.handle('sync:syncNow', async () => {
    try {
      const result = await sync.syncNow();
      return result;
    } catch (error) {
      return {
        success: false,
        changesApplied: 0,
        changesPushed: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  });

  // Get sync status
  ipcMain.handle('sync:status', async () => {
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
  });

  // Get pending change count (offline queue size)
  ipcMain.handle('sync:pendingCount', async () => {
    try {
      return { success: true, count: sync.getPendingCount() };
    } catch (error) {
      return { success: false, count: 0, error: error instanceof Error ? error.message : 'Failed' };
    }
  });

  // Resolve conflict
  ipcMain.handle(
    'sync:resolveConflict',
    async (_event, noteId: string, resolution: 'local' | 'remote') => {
      try {
        await sync.resolveConflict(noteId, resolution);
        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to resolve conflict',
        };
      }
    }
  );

  // Start auto-sync
  ipcMain.handle('sync:startAutoSync', async (_event, intervalMs?: number) => {
    try {
      sync.startAutoSync(intervalMs);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start auto-sync',
      };
    }
  });

  // Stop auto-sync
  ipcMain.handle('sync:stopAutoSync', async () => {
    try {
      sync.stopAutoSync();
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop auto-sync',
      };
    }
  });

  // Tag sync - pull
  ipcMain.handle('sync:pullTags', async () => {
    try {
      return await sync.pullTags();
    } catch (error) {
      return { success: false, applied: 0, error: String(error) };
    }
  });

  // Tag sync - push
  ipcMain.handle('sync:pushTags', async () => {
    try {
      return await sync.pushTags();
    } catch (error) {
      return { success: false, pushed: 0, error: String(error) };
    }
  });

  ipcMain.handle('sync:history', async (_event, limit?: number) => {
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // E2EE Key Management
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if encryption is ready (CEK cached locally)
  ipcMain.handle('encryption:isReady', async () => {
    return { ready: encryption?.isReady() ?? false };
  });

  // Check if this is a first-time setup or existing user
  ipcMain.handle('encryption:getKeyStatus', async () => {
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
  });

  // First device: set up encryption keys with passphrase
  ipcMain.handle('encryption:setupKeys', async (_event, passphrase: string) => {
    try {
      if (!encryption) throw new Error('Encryption service not available');

      const result = await encryption.setupKeys(passphrase);

      // Upload to server
      await client.setEncryptionKeys({
        salt: result.salt,
        wrappedCek: result.wrappedCek,
        wrappedCekRecovery: result.wrappedCekRecovery,
        kdfParams: result.kdfParams,
      });

      return {
        success: true,
        recoveryKey: result.recoveryKey, // Show once to user!
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to setup encryption keys',
      };
    }
  });

  // New device: unlock with passphrase
  ipcMain.handle('encryption:unlockWithPassphrase', async (_event, passphrase: string) => {
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
  });

  // Unlock with recovery key
  ipcMain.handle('encryption:unlockWithRecoveryKey', async (_event, recoveryKey: string) => {
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
  });

  // Migrate legacy per-device key to key hierarchy
  ipcMain.handle('encryption:migrateLegacyKey', async (_event, passphrase: string) => {
    try {
      if (!encryption) throw new Error('Encryption service not available');

      const result = await encryption.migrateLegacyKey(passphrase);

      // Upload to server
      await client.setEncryptionKeys({
        salt: result.salt,
        wrappedCek: result.wrappedCek,
        wrappedCekRecovery: result.wrappedCekRecovery,
        kdfParams: result.kdfParams,
      });

      return {
        success: true,
        recoveryKey: result.recoveryKey,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to migrate legacy key',
      };
    }
  });

  // Change passphrase (re-wrap CEK)
  ipcMain.handle('encryption:changePassphrase', async (_event, newPassphrase: string) => {
    try {
      if (!encryption) throw new Error('Encryption service not available');

      const result = await encryption.changePassphrase(newPassphrase);

      // Upload new wrapped key to server
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Subscription
  // ═══════════════════════════════════════════════════════════════════════════

  // Get subscription status
  ipcMain.handle('subscription:getStatus', async () => {
    try {
      const status = await client.getSubscriptionStatus();
      return {
        success: true,
        status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get subscription status',
      };
    }
  });

  // Open Stripe billing portal
  ipcMain.handle('subscription:openPortal', async (_event, returnUrl: string) => {
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
  });

  // Open checkout (placeholder - opens pricing page)
  ipcMain.handle('subscription:openCheckout', async () => {
    try {
      void shell.openExternal('https://readied.app/pricing');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open checkout',
      };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Devices
  // ═══════════════════════════════════════════════════════════════════════════

  ipcMain.handle('devices:list', async () => {
    try {
      const result = await client.listDevices();
      return result.devices;
    } catch (_error) {
      return [];
    }
  });

  ipcMain.handle('devices:rename', async (_event, deviceId: string, name: string) => {
    try {
      await client.renameDevice(deviceId, name);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename device',
      };
    }
  });

  ipcMain.handle('devices:revoke', async (_event, deviceId: string) => {
    try {
      await client.revokeDevice(deviceId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke device',
      };
    }
  });

  ipcMain.handle('devices:revokeOthers', async () => {
    try {
      const result = await client.revokeOtherDevices();
      return { success: true, revokedCount: result.revokedCount };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke devices',
      };
    }
  });

  ipcMain.handle('devices:getCurrent', async () => {
    try {
      const result = await client.listDevices();
      return result.devices.find(d => d.isCurrent) ?? null;
    } catch (_error) {
      return null;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Encryption Key Management
  // ═══════════════════════════════════════════════════════════════════════════

  // Export encryption key (for backup)
  ipcMain.handle('encryption:exportKey', async () => {
    try {
      if (!encryption) {
        throw new Error('Encryption service not initialized');
      }
      const keyHex = encryption.exportKey();
      return {
        success: true,
        key: keyHex,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export encryption key',
      };
    }
  });

  // Import encryption key (for restore)
  ipcMain.handle('encryption:importKey', async (_event, keyHex: string) => {
    try {
      if (!encryption) {
        throw new Error('Encryption service not initialized');
      }
      await encryption.importKey(keyHex);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import encryption key',
      };
    }
  });
}
