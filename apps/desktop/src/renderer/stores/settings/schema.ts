/**
 * Settings Schema
 *
 * Layer 1: Data model with versioning.
 * This file defines the structure of all settings and their defaults.
 *
 * IMPORTANT: When adding new settings:
 * 1. Add the type to the appropriate interface
 * 2. Add the default value to DEFAULT_SETTINGS
 * 3. Bump SETTINGS_VERSION and add migration logic in settingsStore.ts
 */

// ============================================================================
// Version
// ============================================================================

export const SETTINGS_VERSION = 1;

// ============================================================================
// Section Types
// ============================================================================

/** General application settings */
export interface GeneralSettings {
  /** Default notebook for new notes */
  defaultNotebookId: string;
  /** Remember window position and size on startup */
  rememberWindowPosition: boolean;
}

/** Update checker settings (stateful, not just a boolean) */
export interface UpdatesSettings {
  /** Auto-check for updates on startup */
  autoCheck: boolean;
  /** Timestamp of last check (null if never checked) */
  lastCheckedAt: number | null;
}

/** Appearance and theme settings */
export interface AppearanceSettings {
  /** Color theme: dark, light, or follow system */
  theme: 'dark' | 'light' | 'system';
  /** Accent color for highlights (hex) */
  accentColor: string;
  /** @deprecated No longer used - kept for schema compatibility */
  acrylicBackground: boolean;
}

/** Backup settings */
export interface BackupSettings {
  /** Enable automatic backups */
  autoBackup: boolean;
  /** Backup interval in days */
  backupIntervalDays: number;
  /** Timestamp of last backup (null if never) */
  lastBackupAt: number | null;
}

/** Editor settings for CodeMirror */
export interface EditorSettings {
  /** Font size in pixels */
  fontSize: number;
  /** Font family for editor text */
  fontFamily: string;
  /** Line height multiplier */
  lineHeight: number;
  /** Show line numbers gutter */
  lineNumbers: boolean;
  /** Highlight the current line */
  highlightActiveLine: boolean;
  /** Wrap long lines */
  lineWrapping: boolean;
  /** Show inline image previews */
  inlineImages: boolean;
  /** Allow scrolling past the end of document */
  scrollPastEnd: boolean;
  /** Tab size in spaces */
  tabSize: number;
  /** Use tabs instead of spaces for indentation */
  indentWithTabs: boolean;
  /** Enable spell check in editor */
  spellCheck: boolean;
}

// ============================================================================
// Full Schema (Versioned)
// ============================================================================

export interface SettingsSchemaV1 {
  version: 1;
  general: GeneralSettings;
  updates: UpdatesSettings;
  appearance: AppearanceSettings;
  editor: EditorSettings;
  backup: BackupSettings;
}

/** Current settings schema type */
export type SettingsSchema = SettingsSchemaV1;

/** Section keys (excluding version) */
export type SettingsSection = keyof Omit<SettingsSchema, 'version'>;

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_GENERAL: GeneralSettings = {
  defaultNotebookId: 'inbox',
  rememberWindowPosition: true,
};

export const DEFAULT_UPDATES: UpdatesSettings = {
  autoCheck: true,
  lastCheckedAt: null,
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  accentColor: '#5eead4',
  acrylicBackground: false,
};

export const DEFAULT_EDITOR: EditorSettings = {
  fontSize: 14,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  lineHeight: 1.6,
  lineNumbers: false,
  highlightActiveLine: false,
  lineWrapping: true,
  inlineImages: true,
  scrollPastEnd: true,
  tabSize: 2,
  indentWithTabs: false,
  spellCheck: true,
};

export const DEFAULT_BACKUP: BackupSettings = {
  autoBackup: false,
  backupIntervalDays: 7,
  lastBackupAt: null,
};

/** Complete default settings */
export const DEFAULT_SETTINGS: SettingsSchema = {
  version: 1,
  general: DEFAULT_GENERAL,
  updates: DEFAULT_UPDATES,
  appearance: DEFAULT_APPEARANCE,
  editor: DEFAULT_EDITOR,
  backup: DEFAULT_BACKUP,
};
