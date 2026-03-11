import type { Extension } from '@codemirror/state';
import type { ComponentType } from 'react';
import type { LayoutManager } from './layout/types';
import type { EditorDecorationAPI } from './editor/decorationAPI';
import type { CodeBlockRendererProps } from './preview/codeBlockStore';

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

/** Note summary for listing (no full content) */
export interface NoteSummaryInfo {
  id: string;
  title: string;
  notebookId: string;
  tags: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  status: string;
}

/** Notebook info exposed to plugins (read-only) */
export interface NotebookInfo {
  id: string;
  name: string;
  parentId: string | null;
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

  // Data listing (Phase 2 — read-only)
  listNotes(): Promise<NoteSummaryInfo[]>;
  listNotebooks(): Promise<NotebookInfo[]>;
  listTags(): Promise<string[]>;

  // Events (Phase 3.2)
  onNoteSelected(callback: (note: NoteInfo | null) => void): () => void;
  onNoteCreated(callback: (note: NoteInfo) => void): () => void;
  onNoteDeleted(callback: (noteId: string) => void): () => void;
}

export interface PluginConfigSchemaField {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'range';
  default: unknown;
  description?: string;
  /** For 'enum' type: available options */
  options?: Array<{ value: string; label: string }>;
  /** For 'range' type: minimum value */
  min?: number;
  /** For 'range' type: maximum value */
  max?: number;
  /** For 'range' type: step increment */
  step?: number;
}

export interface PluginConfigSchema {
  [key: string]: PluginConfigSchemaField;
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
  /** Register a remark (mdast) plugin for the markdown preview pipeline */
  registerRemarkPlugin(id: string, plugin: unknown): () => void;
  /** Register a rehype (hast) plugin for the markdown preview pipeline */
  registerRehypePlugin(id: string, plugin: unknown): () => void;
  /** Register a custom React component to replace an HTML element in the preview */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerPreviewComponent(id: string, tagName: string, component: ComponentType<any>): () => void;
  /** Register a custom renderer for fenced code blocks of a specific language */
  registerCodeBlockRenderer(
    id: string,
    language: string,
    component: ComponentType<CodeBlockRendererProps>
  ): () => void;
  /** Register CSS custom properties (theme overrides or custom variables) */
  registerCssVariables(id: string, variables: Record<string, string>): () => void;
  /** Register a complete theme with validated tokens */
  registerTheme(theme: {
    id: string;
    name: string;
    description?: string;
    author?: string;
    colorScheme: 'dark' | 'light';
    tokens: Record<string, string>;
  }): () => void;
  config: PluginConfigAPI;
  log: PluginLogger;
  app: AppAPI;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Plugin API version this plugin targets (e.g. "1") */
  apiVersion?: string;
  /** Plugin dependencies: map of pluginId → semver range (e.g. { "other-plugin": ">=1.0.0" }) */
  dependencies?: Record<string, string>;
  configSchema?: PluginConfigSchema | null;
  activate(context: PluginContext): PluginDisposable | void;
  deactivate?(): void;
}
