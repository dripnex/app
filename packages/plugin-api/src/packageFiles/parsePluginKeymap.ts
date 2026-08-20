import { parsePluginChord, type PluginChord } from './chords';

const CORE_COMMAND = /^(app|editor|note|view|ai|core|plugin):/;

export interface PluginKeymapBinding {
  commandId: string;
  keybinding: PluginChord;
}

export interface ParsePluginKeymapResult {
  bindings: PluginKeymapBinding[];
  errors: string[];
}

export function qualifyPluginCommandId(pluginId: string, raw: string): string {
  const id = raw.trim();
  if (!id) return id;
  if (id.startsWith('plugin:')) return id;
  if (CORE_COMMAND.test(id) && !id.startsWith(`${pluginId}:`)) return id;
  if (id.startsWith(`${pluginId}:`)) return `plugin:${id}`;
  return `plugin:${pluginId}:${id}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function addBinding(
  pluginId: string,
  commandRaw: string,
  chordRaw: string,
  bindings: PluginKeymapBinding[],
  errors: string[],
  path: string
): void {
  const chord = parsePluginChord(chordRaw);
  if (!chord) {
    errors.push(`${path}: invalid chord "${chordRaw}"`);
    return;
  }
  const commandId = qualifyPluginCommandId(pluginId, commandRaw);
  if (!commandId) {
    errors.push(`${path}: empty command id`);
    return;
  }
  bindings.push({ commandId, keybinding: chord });
}

/**
 * Plugin package keymap.
 *
 * Dripnex: `{ "say-hello": "Mod+Shift+H" }`
 * Inkdrop: `{ "body": { "ctrl-alt-n": "my-plugin:say" } }`
 */
export function parsePluginKeymap(source: string, pluginId: string): ParsePluginKeymapResult {
  const bindings: PluginKeymapBinding[] = [];
  const errors: string[] = [];
  const trimmed = source.trim();
  if (!trimmed) return { bindings, errors };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { bindings, errors: [`Invalid JSON: ${message}`] };
  }

  if (!isPlainObject(parsed)) {
    return { bindings, errors: ['Keymap must be a JSON object'] };
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('_')) continue;
    if (typeof value === 'string') {
      addBinding(pluginId, key, value, bindings, errors, key);
      continue;
    }
    if (isPlainObject(value)) {
      for (const [chord, command] of Object.entries(value)) {
        if (typeof command !== 'string') {
          errors.push(`"${key}"."${chord}": expected a command id`);
          continue;
        }
        addBinding(pluginId, command, chord, bindings, errors, `${key}.${chord}`);
      }
      continue;
    }
    if (value === null) continue;
    errors.push(`"${key}": expected a chord string or selector map`);
  }

  return { bindings, errors };
}
