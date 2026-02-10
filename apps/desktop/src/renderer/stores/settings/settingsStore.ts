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
  EditorSettings,
  BackupSettings,
  DEFAULT_SETTINGS,
  DEFAULT_GENERAL,
  DEFAULT_UPDATES,
  DEFAULT_APPEARANCE,
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

  // Migration: v0 (or undefined) -> v1
  if (version < 1) {
    settings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      version: 1,
      // Ensure all sections exist with defaults
      general: { ...DEFAULT_GENERAL, ...settings.general },
      updates: { ...DEFAULT_UPDATES, ...settings.updates },
      appearance: { ...DEFAULT_APPEARANCE, ...settings.appearance },
      editor: { ...DEFAULT_EDITOR, ...settings.editor },
      backup: { ...DEFAULT_BACKUP, ...settings.backup },
    };
  }

  // Future migrations go here:
  // if (version < 2) { ... migrate to v2 ... }

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
  window.readied.settings.onSync((settings: unknown) => {
    isRemoteUpdate = true;
    useSettingsStore.setState({ settings: settings as SettingsSchema });
    isRemoteUpdate = false;
  });

  // Emit changes to other windows when settings change locally
  let prevSettings = useSettingsStore.getState().settings;
  useSettingsStore.subscribe(state => {
    if (!isRemoteUpdate && state.settings !== prevSettings) {
      window.readied.settings.broadcast(state.settings as unknown as Record<string, unknown>);
    }
    prevSettings = state.settings;
  });
}
