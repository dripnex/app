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

import { DEFAULT_MODEL } from '@dripnex/ai-core';

// ============================================================================
// Version
// ============================================================================

export const SETTINGS_VERSION = 5;

// ============================================================================
// Section Types
// ============================================================================

/** General application settings */
export interface GeneralSettings {
  /** Default notebook for new notes */
  defaultNotebookId: string;
  /** Remember window position and size on startup */
  rememberWindowPosition: boolean;
  /** Right-click Inspect Element and Toggle Developer Tools */
  developmentMode: boolean;
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
  /** Zoom level for the interface */
  zoomLevel: string;
  /** @deprecated No longer used - kept for schema compatibility */
  acrylicBackground: boolean;
  /** Active plugin theme ID (null = use base dark/light) */
  activeThemeId: string | null;
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

/** AI Assistant settings */
export interface AiSettings {
  /** LLM provider id */
  provider: 'dripnex' | 'anthropic' | 'openai' | 'grok' | 'ollama';
  /** API key (provider-specific) */
  apiKey: string;
  /** Model id */
  model: string;
  /** Maximum number of notes to include as context */
  maxContextNotes: number;
  /** Ollama (or compatible) base URL. Empty = default localhost:11434 */
  baseUrl?: string;
  /** Local index embed provider */
  embedProvider: 'ollama' | 'openai';
  /** Embedding model id (must match the provider) */
  embedModel: string;
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

export interface SettingsSchemaV2 extends Omit<SettingsSchemaV1, 'version'> {
  version: 2;
  ai: AiSettings;
}

export interface SettingsSchemaV3 extends Omit<SettingsSchemaV2, 'version'> {
  version: 3;
}

export interface SettingsSchemaV4 extends Omit<SettingsSchemaV3, 'version'> {
  version: 4;
}

export interface SettingsSchemaV5 extends Omit<SettingsSchemaV4, 'version'> {
  version: 5;
}

/** Current settings schema type */
export type SettingsSchema = SettingsSchemaV5;

/** Section keys (excluding version) */
export type SettingsSection = keyof Omit<SettingsSchema, 'version'>;

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_GENERAL: GeneralSettings = {
  defaultNotebookId: 'inbox',
  rememberWindowPosition: true,
  developmentMode: false,
};

export const DEFAULT_UPDATES: UpdatesSettings = {
  autoCheck: true,
  lastCheckedAt: null,
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  accentColor: '#5eead4',
  zoomLevel: '1.0',
  acrylicBackground: false,
  activeThemeId: null,
};

export const DEFAULT_AI: AiSettings = {
  provider: 'dripnex',
  apiKey: '',
  model: DEFAULT_MODEL,
  maxContextNotes: 5,
  baseUrl: '',
  embedProvider: 'ollama',
  embedModel: 'nomic-embed-text',
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
  version: 5,
  general: DEFAULT_GENERAL,
  updates: DEFAULT_UPDATES,
  appearance: DEFAULT_APPEARANCE,
  ai: DEFAULT_AI,
  editor: DEFAULT_EDITOR,
  backup: DEFAULT_BACKUP,
};
