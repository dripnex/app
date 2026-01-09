import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Backup settings state
 */
export interface BackupSettings {
  /** Last backup timestamp (epoch ms), null if never backed up */
  lastBackupAt: number | null;
}

/**
 * Sync settings state
 */
export interface SyncSettings {
  /** Whether auto-sync is enabled */
  enabled: boolean;
  /** Auto-sync interval in minutes */
  autoSyncInterval: number;
  /** Last sync timestamp (epoch ms), null if never synced */
  lastSyncAt: number | null;
}

// ============================================================================
// Store Interface
// ============================================================================

interface SettingsState {
  /** Backup settings */
  backup: BackupSettings;
  /** Sync settings */
  sync: SyncSettings;

  // Actions
  updateBackup: (backup: Partial<BackupSettings>) => void;
  updateSync: (sync: Partial<SyncSettings>) => void;
  resetSettings: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialBackup: BackupSettings = {
  lastBackupAt: null,
};

const initialSync: SyncSettings = {
  enabled: true,
  autoSyncInterval: 5, // 5 minutes
  lastSyncAt: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      backup: initialBackup,
      sync: initialSync,

      // Actions
      updateBackup: (backup) =>
        set((state) => ({
          backup: { ...state.backup, ...backup },
        })),

      updateSync: (sync) =>
        set((state) => ({
          sync: { ...state.sync, ...sync },
        })),

      resetSettings: () =>
        set({
          backup: initialBackup,
          sync: initialSync,
        }),
    }),
    {
      name: 'readied-settings', // localStorage key
      version: 1,
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectBackup = (state: SettingsState) => state.backup;
export const selectSync = (state: SettingsState) => state.sync;
export const selectLastBackupAt = (state: SettingsState) => state.backup.lastBackupAt;
export const selectLastSyncAt = (state: SettingsState) => state.sync.lastSyncAt;
export const selectAutoSyncEnabled = (state: SettingsState) => state.sync.enabled;
export const selectAutoSyncInterval = (state: SettingsState) => state.sync.autoSyncInterval;
