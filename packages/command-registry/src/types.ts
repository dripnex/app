export type KeyModifier = 'Mod' | 'Shift' | 'Alt' | 'Ctrl';

export interface KeyBinding {
  key: string;
  modifiers: readonly KeyModifier[];
}

export type CommandCategory =
  | 'editor'
  | 'editor:history'
  | 'navigation'
  | 'note'
  | 'view'
  | 'app'
  | 'data'
  | 'plugin'
  | 'ai';

export type CommandContext = 'editor' | 'note-list' | 'app' | 'global';

export interface CommandDefinition {
  id: string;
  name: string;
  description?: string;
  category: CommandCategory;
  context: CommandContext;
  defaultKeybinding?: KeyBinding;
  icon?: string;
  enabled?: boolean;
  showInPalette?: boolean;
}

/** Optional args for `dispatch(id, payload)` — Inkdrop `commands.dispatch(el, name, detail)`. */
export type CommandPayload = Record<string, unknown>;

export interface RegisteredCommand extends CommandDefinition {
  execute: (payload?: CommandPayload) => boolean | void | Promise<boolean | void>;
}

export interface KeyBindingOverride {
  commandId: string;
  keybinding: KeyBinding | null;
}
