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
  | 'plugin';

export type CommandContext = 'editor' | 'app' | 'global';

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

export interface RegisteredCommand extends CommandDefinition {
  execute: () => boolean | void | Promise<boolean | void>;
}

export interface KeyBindingOverride {
  commandId: string;
  keybinding: KeyBinding | null;
}
