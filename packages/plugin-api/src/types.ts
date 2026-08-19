import type { Extension } from '@codemirror/state';
import type { ComponentType } from 'react';
import type { LayoutManager } from './layout/types';
import type { EditorDecorationAPI } from './editor/decorationAPI';
import type { CodeBlockRendererProps } from './preview/codeBlockStore';
import type { DataAPI } from './data/createDataAPI';
import type { PluginComponents } from './components/catalog';
import type { MarkdownRenderer } from './preview/createMarkdownRenderer';

/** Controlled subset of editor operations for plugins */
export interface EditorAPI {
  getContent(): string;
  getSelection(): { from: number; to: number };
  replaceRange(from: number, to: number, text: string): void;
  insertAtCursor(text: string): void;
  setSelection(from: number, to?: number): void;
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
  icon?: string | null;
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
  /** Live updates from Settings or other windows. Returns unsubscribe. */
  observe<T>(key: string, callback: (value: T) => void): () => void;
}

export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
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

/** Options for registering a custom AI command */
export interface PluginAiCommandOptions {
  /** Command id (will be auto-prefixed with plugin id) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** System prompt for the AI */
  systemPrompt: string;
  /**
   * User prompt template. Supports placeholders:
   * - {{selection}} — replaced with editor selection
   * - {{note}} — replaced with full note content
   * - {{title}} — replaced with note title
   */
  userPromptTemplate: string;
  /** Lucide icon name (e.g. "Wand2") */
  icon?: string;
  /** Where to put the AI response: 'replace' selection, 'insert' at cursor, or 'panel' (chat). Default: 'panel' */
  outputTarget?: 'replace' | 'insert' | 'panel';
  /** Category tag for organization (e.g. "writing", "coding") */
  category?: string;
}

/** Options for registering a remark/rehype plugin */
export interface PluginHookOptions {
  /** Display name for debugging (defaults to pluginId) */
  name?: string;
  /** Plugin version for debugging */
  version?: string;
  /** Execution priority — lower runs first. Default: 100 */
  priority?: number;
}

export interface PluginContext {
  layout: LayoutManager;
  editor: EditorAPI;
  decorations: EditorDecorationAPI;
  registerExtensions(id: string, extensions: Extension[]): () => void;
  registerCommand(
    options: PluginCommandOptions,
    execute: (payload?: Record<string, unknown>) => boolean | void | Promise<boolean | void>
  ): () => void;
  /** Register a remark (mdast) plugin for the markdown preview pipeline */
  registerRemarkPlugin(id: string, plugin: unknown, options?: PluginHookOptions): () => void;
  /** Register a rehype (hast) plugin for the markdown preview pipeline */
  registerRehypePlugin(id: string, plugin: unknown, options?: PluginHookOptions): () => void;
  /** Register a custom React component to replace an HTML element in the preview */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerPreviewComponent(id: string, tagName: string, component: ComponentType<any>): () => void;
  /** Register a custom renderer for fenced code blocks of a specific language */
  registerCodeBlockRenderer(
    id: string,
    language: string,
    component: ComponentType<CodeBlockRendererProps>
  ): () => void;
  /**
   * Register a custom AI command.
   * The command will appear in the AI panel's command list and in the command palette.
   * Template placeholders ({{selection}}, {{note}}, {{title}}) are resolved at execution time.
   * Returns an unregister function.
   */
  registerAiCommand(options: PluginAiCommandOptions): () => void;
  /** Register CSS custom properties (theme overrides or custom variables) */
  registerCssVariables(id: string, variables: Record<string, string>): () => void;
  /**
   * Add an item to the application Plugins menu.
   * `click` is registered as a command. `command` reuses an existing command id.
   */
  menu: {
    add(item: {
      label: string;
      accelerator?: string;
      command?: string;
      click?: () => boolean | void | Promise<boolean | void>;
    }): () => void;
  };
  clipboard: {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
  };
  notifications: {
    addSuccess(message: string): void;
    addInfo(message: string): void;
    addWarning(message: string): void;
    addError(message: string): void;
  };
  contextMenu: {
    add(
      target: 'note-list-item' | 'notebook-item' | 'tag-item' | 'editor',
      item: {
        label: string;
        command?: string;
        click?: (payload?: Record<string, unknown>) => boolean | void | Promise<boolean | void>;
      }
    ): () => void;
  };
  /**
   * Stock React UI: Button, Modal, Dialog (Inkdrop Component Manager).
   * Mount overlays with `layout.addComponent('modal', …)`.
   */
  components: PluginComponents;
  /**
   * Preview DOM events (Inkdrop `inkdrop.components.preview.on`).
   * Return `false` from a handler to prevent the default action.
   */
  preview: {
    on(
      event: 'a:click' | 'checkbox:change',
      handler: (detail: {
        href?: string;
        text?: string;
        index?: number;
        checked?: boolean;
      }) => boolean | void
    ): () => void;
  };
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
  /** Rich data query API for notes, notebooks, tags, links, and graph */
  data: DataAPI;
  /**
   * Inkdrop `markdownRenderer`: remark/rehype arrays, React element map,
   * fenced-code map, and preview events.
   */
  markdownRenderer: MarkdownRenderer;
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
