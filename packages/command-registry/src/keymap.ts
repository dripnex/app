import type { KeyBinding, KeyBindingOverride, KeyModifier } from './types';

const MOD_ALIASES = new Set([
  'mod',
  'cmd',
  'command',
  'cmdorctrl',
  'commandorcontrol',
  'ctrl',
  'control',
  'meta',
]);

/**
 * Parse "Mod+Shift+K" into a KeyBinding.
 * Cmd / Ctrl / CommandOrControl all become Mod (matches the live key handler).
 */
export function parseChord(raw: string): KeyBinding | null {
  const parts = raw
    .split('+')
    .map(part => part.trim())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) return null;

  const modifiers: KeyModifier[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (MOD_ALIASES.has(lower)) {
      if (!modifiers.includes('Mod')) modifiers.push('Mod');
      continue;
    }
    if (lower === 'shift') {
      if (!modifiers.includes('Shift')) modifiers.push('Shift');
      continue;
    }
    if (lower === 'alt' || lower === 'option') {
      if (!modifiers.includes('Alt')) modifiers.push('Alt');
      continue;
    }
    return null;
  }

  return { key: key.toLowerCase(), modifiers };
}

export function stripJsonc(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

export interface ParseKeymapResult {
  overrides: KeyBindingOverride[];
  errors: string[];
}

/**
 * User keymap: `{ "command.id": "Mod+Shift+K" | null }`.
 * `null` unbinds the default. Keys starting with `_` are ignored.
 */
export function parseKeymap(source: string): ParseKeymapResult {
  const overrides: KeyBindingOverride[] = [];
  const errors: string[] = [];
  const trimmed = source.trim();
  if (!trimmed) return { overrides, errors };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(trimmed));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { overrides, errors: [`Invalid JSON: ${message}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { overrides, errors: ['Keymap must be a JSON object of command id → chord'] };
  }

  for (const [commandId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (commandId.startsWith('_')) continue;
    if (value === null) {
      overrides.push({ commandId, keybinding: null });
      continue;
    }
    if (typeof value !== 'string') {
      errors.push(`"${commandId}": expected a chord string or null`);
      continue;
    }
    const chord = parseChord(value);
    if (!chord) {
      errors.push(`"${commandId}": invalid chord "${value}"`);
      continue;
    }
    overrides.push({ commandId, keybinding: chord });
  }

  return { overrides, errors };
}
