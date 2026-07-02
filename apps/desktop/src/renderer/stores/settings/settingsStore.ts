/**
 * Settings Store
 *
 * Layer 2: State management with Zustand + persist.
 * Handles persistence to localStorage and migrations between versions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SettingsSchema,
  SettingsSection,
  GeneralSettings,
  UpdatesSettings,
  AppearanceSettings,
  AiSettings,
  EditorSettings,
  BackupSettings,
  DEFAULT_SETTINGS,
  DEFAULT_GENERAL,
  DEFAULT_UPDATES,
  DEFAULT_APPEARANCE,
  DEFAULT_AI,
  DEFAULT_EDITOR,
  DEFAULT_BACKUP,
  SETTINGS_VERSION,
} from './schema';

// ============================================================================
// Store Interface
// ============================================================================

interface SettingsStore {
  /** Current settings state */
  settings: SettingsSchema;

  // Granular update actions (immutable updates)
  updateGeneral: (updates: Partial<GeneralSettings>) => void;
  updateUpdates: (updates: Partial<UpdatesSettings>) => void;
  updateAppearance: (updates: Partial<AppearanceSettings>) => void;
  updateAi: (updates: Partial<AiSettings>) => void;
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateBackup: (updates: Partial<BackupSettings>) => void;

  // Reset actions
  resetSection: (section: SettingsSection) => void;
  resetAll: () => void;
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Migrate settings from older versions to current version.
 * Add cases here when bumping SETTINGS_VERSION.
 */
function migrateSettings(persisted: unknown, version: number): { settings: SettingsSchema } {
  // Type guard for persisted state
  const state = persisted as { settings?: Partial<SettingsSchema> } | undefined;

  // If no persisted state or no settings, return defaults
  if (!state?.settings) {
    return { settings: DEFAULT_SETTINGS };
  }

  let settings = state.settings as SettingsSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mutable = settings as any;

  // Migration: v0 (or undefined) -> v1
  if (version < 1) {
    mutable = {
      ...DEFAULT_SETTINGS,
      ...mutable,
      version: 1,
      // Ensure all sections exist with defaults
      general: { ...DEFAULT_GENERAL, ...mutable.general },
      updates: { ...DEFAULT_UPDATES, ...mutable.updates },
      appearance: { ...DEFAULT_APPEARANCE, ...mutable.appearance },
      editor: { ...DEFAULT_EDITOR, ...mutable.editor },
      backup: { ...DEFAULT_BACKUP, ...mutable.backup },
    };
  }

  // Migration: v1 -> v2 (add AI settings)
  if (version < 2) {
    mutable = {
      ...mutable,
      version: 2,
      ai: { ...DEFAULT_AI, ...mutable.ai },
    };
  }

  // Migration: v2 -> v3 (add provider field to AI settings)
  if (version < 3) {
    mutable = {
      ...mutable,
      version: 3,
      ai: { provider: 'anthropic', ...mutable.ai },
    };
  }

  settings = mutable as SettingsSchema;
  return { settings };
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      settings: DEFAULT_SETTINGS,

      // Update general settings
      updateGeneral: updates =>
        set(state => ({
          settings: {
            ...state.settings,
            general: { ...state.settings.general, ...updates },
          },
        })),

      // Update updates settings
      updateUpdates: updates =>
        set(state => ({
          settings: {
            ...state.settings,
            updates: { ...state.settings.updates, ...updates },
          },
        })),

      // Update appearance settings
      updateAppearance: updates =>
        set(state => ({
          settings: {
            ...state.settings,
            appearance: { ...state.settings.appearance, ...updates },
          },
        })),

      // Update AI settings
      updateAi: updates =>
        set(state => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, ...updates },
          },
        })),

      // Update editor settings
      updateEditor: updates =>
        set(state => ({
          settings: {
            ...state.settings,
            editor: { ...state.settings.editor, ...updates },
          },
        })),

      // Update backup settings
      updateBackup: updates =>
        set(state => ({
          settings: {
            ...state.settings,
            backup: { ...state.settings.backup, ...updates },
          },
        })),

      // Reset a specific section to defaults
      resetSection: section =>
        set(state => {
          const defaults: Record<SettingsSection, unknown> = {
            general: DEFAULT_GENERAL,
            updates: DEFAULT_UPDATES,
            appearance: DEFAULT_APPEARANCE,
            ai: DEFAULT_AI,
            editor: DEFAULT_EDITOR,
            backup: DEFAULT_BACKUP,
          };
          return {
            settings: {
              ...state.settings,
              [section]: defaults[section],
            },
          };
        }),

      // Reset all settings to defaults
      resetAll: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'readied-settings',
      version: SETTINGS_VERSION,
      migrate: migrateSettings,
      // SECURITY: never persist the AI API key to localStorage. The key is
      // stored encrypted via Electron safeStorage (OS keychain) and rehydrated
      // into memory on demand (see AiPanel/AiSection). Writing it here would
      // leave it in cleartext on disk, defeating safeStorage.
      partialize: state => ({
        settings: {
          ...state.settings,
          ai: { ...state.settings.ai, apiKey: '' },
        },
      }),
    }
  )
);

// ============================================================================
// Selectors (for convenience)
// ============================================================================

export const selectSettings = (state: SettingsStore) => state.settings;
export const selectGeneral = (state: SettingsStore) => state.settings.general;
export const selectUpdates = (state: SettingsStore) => state.settings.updates;
export const selectAppearance = (state: SettingsStore) => state.settings.appearance;
export const selectAi = (state: SettingsStore) => state.settings.ai;
export const selectEditor = (state: SettingsStore) => state.settings.editor;
export const selectBackup = (state: SettingsStore) => state.settings.backup;

// Individual editor settings selectors (for CodeMirror integration)
export const selectFontSize = (state: SettingsStore) => state.settings.editor.fontSize;
export const selectFontFamily = (state: SettingsStore) => state.settings.editor.fontFamily;
export const selectLineHeight = (state: SettingsStore) => state.settings.editor.lineHeight;
export const selectLineNumbers = (state: SettingsStore) => state.settings.editor.lineNumbers;
export const selectHighlightActiveLine = (state: SettingsStore) =>
  state.settings.editor.highlightActiveLine;
export const selectLineWrapping = (state: SettingsStore) => state.settings.editor.lineWrapping;
export const selectInlineImages = (state: SettingsStore) => state.settings.editor.inlineImages;
export const selectScrollPastEnd = (state: SettingsStore) => state.settings.editor.scrollPastEnd;
export const selectTabSize = (state: SettingsStore) => state.settings.editor.tabSize;
export const selectIndentWithTabs = (state: SettingsStore) => state.settings.editor.indentWithTabs;
export const selectSpellCheck = (state: SettingsStore) => state.settings.editor.spellCheck;

// ============================================================================
// Cross-Window Sync via IPC
// ============================================================================

// Anti-loop flag: prevents re-emitting when receiving sync from another window
let isRemoteUpdate = false;

// Setup sync listeners (only in browser environment with preload API available)
if (typeof window !== 'undefined' && window.readied?.settings) {
  // Listen for settings sync from other windows
  window.readied.settings.onSync((incoming: unknown) => {
    // Only accept full settings objects (must have version + all sections)
    const data = incoming as Record<string, unknown> | null;
    if (!data || typeof data !== 'object' || !data.version || !data.editor) return;

    // Cast through unknown to satisfy TS
    const s = data as unknown as Partial<SettingsSchema>;

    // Merge with defaults to ensure no section is undefined
    const merged: SettingsSchema = {
      ...DEFAULT_SETTINGS,
      ...s,
      general: { ...DEFAULT_GENERAL, ...s.general },
      updates: { ...DEFAULT_UPDATES, ...s.updates },
      appearance: { ...DEFAULT_APPEARANCE, ...s.appearance },
      ai: { ...DEFAULT_AI, ...s.ai },
      editor: { ...DEFAULT_EDITOR, ...s.editor },
      backup: { ...DEFAULT_BACKUP, ...s.backup },
    };

    isRemoteUpdate = true;
    useSettingsStore.setState({ settings: merged });
    isRemoteUpdate = false;
  });

  // Emit changes to other windows when settings change locally
  let prevSettings = useSettingsStore.getState().settings;
  useSettingsStore.subscribe(state => {
    if (!isRemoteUpdate && state.settings !== prevSettings) {
      // SECURITY: strip the API key before broadcasting across windows. Each
      // window rehydrates the key from safeStorage on its own; it must never
      // travel over the cross-window IPC channel in cleartext.
      const safeSettings = {
        ...state.settings,
        ai: { ...state.settings.ai, apiKey: '' },
      };
      window.readied.settings.broadcast(safeSettings as unknown as Record<string, unknown>);
    }
    prevSettings = state.settings;
  });
}
