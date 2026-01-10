import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Editor settings state
 */
export interface EditorSettings {
  /** Show line numbers */
  lineNumbers: boolean;
  /** Highlight the active line */
  highlightActiveLine: boolean;
  /** Wrap long lines */
  lineWrapping: boolean;
  /** Show inline image previews */
  inlineImages: boolean;
  /** Allow scrolling past end of document */
  scrollPastEnd: boolean;
  /** Enable spell checking */
  spellCheck: boolean;
  /** Font size in pixels */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Line height */
  lineHeight: number;
  /** Tab size in spaces */
  tabSize: number;
  /** Use tabs for indentation (false = spaces) */
  indentWithTabs: boolean;
}

/**
 * General settings state
 */
export interface GeneralSettings {
  /** Default notebook ID for new notes */
  defaultNotebookId: string | null;
  /** Show system notifications */
  showNotifications: boolean;
  /** Remember window position and size */
  rememberWindowPosition: boolean;
}

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
  /** Editor settings */
  editor: EditorSettings;
  /** General settings */
  general: GeneralSettings;
  /** Backup settings */
  backup: BackupSettings;
  /** Sync settings */
  sync: SyncSettings;

  // Actions
  updateEditor: (editor: Partial<EditorSettings>) => void;
  updateGeneral: (general: Partial<GeneralSettings>) => void;
  updateBackup: (backup: Partial<BackupSettings>) => void;
  updateSync: (sync: Partial<SyncSettings>) => void;
  resetSettings: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialEditor: EditorSettings = {
  lineNumbers: true,
  highlightActiveLine: true,
  lineWrapping: true,
  inlineImages: true,
  scrollPastEnd: true,
  spellCheck: false,
  fontSize: 16,
  fontFamily: 'JetBrains Mono, SF Mono, Monaco, Consolas, monospace',
  lineHeight: 1.6,
  tabSize: 2,
  indentWithTabs: false,
};

const initialGeneral: GeneralSettings = {
  defaultNotebookId: null,
  showNotifications: true,
  rememberWindowPosition: true,
};

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
      editor: initialEditor,
      general: initialGeneral,
      backup: initialBackup,
      sync: initialSync,

      // Actions
      updateEditor: (editor) =>
        set((state) => ({
          editor: { ...state.editor, ...editor },
        })),

      updateGeneral: (general) =>
        set((state) => ({
          general: { ...state.general, ...general },
        })),

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
          editor: initialEditor,
          general: initialGeneral,
          backup: initialBackup,
          sync: initialSync,
        }),
    }),
    {
      name: 'readied-settings', // localStorage key
      version: 2, // Incremented version due to new fields
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectEditor = (state: SettingsState) => state.editor;
export const selectGeneral = (state: SettingsState) => state.general;
export const selectBackup = (state: SettingsState) => state.backup;
export const selectSync = (state: SettingsState) => state.sync;
export const selectLastBackupAt = (state: SettingsState) => state.backup.lastBackupAt;
export const selectLastSyncAt = (state: SettingsState) => state.sync.lastSyncAt;
export const selectAutoSyncEnabled = (state: SettingsState) => state.sync.enabled;
export const selectAutoSyncInterval = (state: SettingsState) => state.sync.autoSyncInterval;
