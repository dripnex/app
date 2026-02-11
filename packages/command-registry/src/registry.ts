import type {
  RegisteredCommand,
  KeyBinding,
  KeyBindingOverride,
  CommandCategory,
  CommandContext,
} from './types';

type Listener = () => void;

/**
 * Serialize a KeyBinding to a stable string for comparison.
 * Format: "Mod+Shift+b" (modifiers sorted alphabetically, key lowercase)
 */
export function serializeKeybinding(kb: KeyBinding): string {
  const mods = [...kb.modifiers].sort().join('+');
  const key = kb.key.toLowerCase();
  return mods ? `${mods}+${key}` : key;
}

/** Check if two keybindings match */
export function keybindingsMatch(a: KeyBinding, b: KeyBinding): boolean {
  return serializeKeybinding(a) === serializeKeybinding(b);
}

/** Format a keybinding for display (macOS style) */
export function formatKeybinding(kb: KeyBinding | undefined): string {
  if (!kb) return '';

  const isMac =
    typeof globalThis !== 'undefined' &&
    'navigator' in globalThis &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).navigator?.platform as string | undefined)?.startsWith('Mac') === true;

  const modMap: Record<string, string> = isMac
    ? { Mod: '\u2318', Shift: '\u21e7', Alt: '\u2325', Ctrl: '\u2303' }
    : { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Ctrl: 'Ctrl' };

  const parts = kb.modifiers.map(m => modMap[m] ?? m);
  const key = kb.key.length === 1 ? kb.key.toUpperCase() : kb.key;
  parts.push(key);

  return isMac ? parts.join('') : parts.join('+');
}

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommand>();
  private overrides = new Map<string, KeyBinding | null>();
  private listeners = new Set<Listener>();
  private cachedSnapshot: RegisteredCommand[] = [];

  /** Register a command. Replaces existing if same id. */
  register(command: RegisteredCommand): () => void {
    this.commands.set(command.id, command);
    this.invalidateSnapshot();
    this.notify();
    return () => this.unregister(command.id);
  }

  /** Remove a command by id */
  unregister(id: string): void {
    if (this.commands.delete(id)) {
      this.invalidateSnapshot();
      this.notify();
    }
  }

  /** Execute a command by id. Returns false if not found or disabled. */
  async dispatch(id: string): Promise<boolean> {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    if (cmd.enabled === false) return false;

    const result = await cmd.execute();
    return result !== false;
  }

  /** Get a command by id */
  get(id: string): RegisteredCommand | undefined {
    return this.commands.get(id);
  }

  /** Get all registered commands (returns cached array for referential stability) */
  getAll(): RegisteredCommand[] {
    return this.cachedSnapshot;
  }

  /** Get commands by category */
  getByCategory(category: CommandCategory): RegisteredCommand[] {
    return this.getAll().filter(c => c.category === category);
  }

  /** Get commands by context */
  getByContext(context: CommandContext): RegisteredCommand[] {
    return this.getAll().filter(c => c.context === context);
  }

  /** Get effective keybinding (user override > default) */
  getKeybinding(id: string): KeyBinding | undefined {
    if (this.overrides.has(id)) {
      return this.overrides.get(id) ?? undefined;
    }
    return this.commands.get(id)?.defaultKeybinding;
  }

  /** Set a user keybinding override */
  setKeybindingOverride(override: KeyBindingOverride): void {
    this.overrides.set(override.commandId, override.keybinding);
    this.notify();
  }

  /** Find command by keybinding within a given context */
  findByKeybinding(kb: KeyBinding, context?: CommandContext): RegisteredCommand | undefined {
    for (const cmd of this.commands.values()) {
      if (context && cmd.context !== context && cmd.context !== 'global') continue;
      const effective = this.getKeybinding(cmd.id);
      if (effective && keybindingsMatch(effective, kb)) {
        return cmd;
      }
    }
    return undefined;
  }

  /** Detect keybinding conflicts (same binding, same context) */
  getConflicts(): Array<{ keybinding: string; commands: RegisteredCommand[] }> {
    const byKey = new Map<string, RegisteredCommand[]>();

    for (const cmd of this.commands.values()) {
      const kb = this.getKeybinding(cmd.id);
      if (!kb) continue;
      const key = `${cmd.context}:${serializeKeybinding(kb)}`;
      const list = byKey.get(key) ?? [];
      list.push(cmd);
      byKey.set(key, list);
    }

    return Array.from(byKey.entries())
      .filter(([, cmds]) => cmds.length > 1)
      .map(([key, commands]) => ({ keybinding: key, commands }));
  }

  /** Subscribe to changes (for React integration via useSyncExternalStore) */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Get a snapshot for useSyncExternalStore */
  getSnapshot(): RegisteredCommand[] {
    return this.getAll();
  }

  private invalidateSnapshot(): void {
    this.cachedSnapshot = Array.from(this.commands.values());
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
