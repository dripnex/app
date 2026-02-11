import type { Extension } from '@codemirror/state';
import type { LayoutManager } from './layout/types';
import type { EditorDecorationAPI } from './editor/decorationAPI';

/** Controlled subset of editor operations for plugins */
export interface EditorAPI {
  getContent(): string;
  getSelection(): { from: number; to: number };
  replaceRange(from: number, to: number, text: string): void;
  insertAtCursor(text: string): void;
  getWordCount(): number;
  getCharCount(): number;
  getLineCount(): number;
  onDocChanged(callback: (content: string) => void): () => void;
  onSelectionChanged(callback: (sel: { from: number; to: number }) => void): () => void;
  focus(): void;
}

/** Slim note info exposed to plugins (read-only) */
export interface NoteInfo {
  id: string;
  title: string;
  content: string;
}

/** Read-only app operations for plugins */
export interface AppAPI {
  // Core (Phase 1)
  getCurrentNote(): NoteInfo | null;
  searchNotes(query: string): Promise<Array<{ id: string; title: string }>>;

  // Extended read-only (Phase 3.1)
  getNoteById(id: string): Promise<NoteInfo | null>;
  getNoteTags(noteId: string): Promise<string[]>;
  getBacklinks(noteId: string): Promise<Array<{ noteId: string; noteTitle: string }>>;

  // Events (Phase 3.2)
  onNoteSelected(callback: (note: NoteInfo | null) => void): () => void;
  onNoteCreated(callback: (note: NoteInfo) => void): () => void;
  onNoteDeleted(callback: (noteId: string) => void): () => void;
}

export interface PluginConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean';
    default: unknown;
    description?: string;
  };
}

export interface PluginConfigAPI {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface PluginDisposable {
  dispose(): void;
}

export interface PluginCommandOptions {
  id: string;
  name: string;
  category?: string;
  keybinding?: { key: string; modifiers?: readonly string[] };
  icon?: string;
  showInPalette?: boolean;
}

export interface PluginContext {
  layout: LayoutManager;
  editor: EditorAPI;
  decorations: EditorDecorationAPI;
  registerExtensions(id: string, extensions: Extension[]): () => void;
  registerCommand(
    options: PluginCommandOptions,
    execute: () => boolean | void | Promise<boolean | void>
  ): () => void;
  config: PluginConfigAPI;
  log: PluginLogger;
  app: AppAPI;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  configSchema?: PluginConfigSchema | null;
  activate(context: PluginContext): PluginDisposable | void;
  deactivate?(): void;
}
