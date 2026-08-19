export interface PluginChord {
  key: string;
  modifiers: string[];
}

const MOD_ALIASES: Record<string, string> = {
  mod: 'Mod',
  cmd: 'Mod',
  command: 'Mod',
  cmdorctrl: 'Mod',
  commandorcontrol: 'Mod',
  ctrl: 'Mod',
  control: 'Mod',
  meta: 'Mod',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
};

/**
 * Parse `Mod+Shift+K` or Inkdrop `ctrl-alt-n` into a chord.
 */
export function parsePluginChord(raw: string): PluginChord | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.includes('+') ? trimmed.split('+') : trimmed.split('-');
  const mapped = parts.map(part => part.trim()).filter(Boolean);
  const key = mapped.pop();
  if (!key) return null;

  const modifiers: string[] = [];
  for (const part of mapped) {
    const alias = MOD_ALIASES[part.toLowerCase()];
    if (!alias) return null;
    if (!modifiers.includes(alias)) modifiers.push(alias);
  }

  return { key: key.toLowerCase(), modifiers };
}
