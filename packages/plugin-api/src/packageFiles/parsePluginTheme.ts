import type { PluginManifest } from '../types';
import type { ThemeDefinition } from '../theme/themeTypes';
import { validateThemeTokens } from '../theme/themeTypes';

export interface ParsePluginThemeResult {
  theme: ThemeDefinition | null;
  errors: string[];
}

/** Parse a community theme.json (token layer). */
export function parsePluginTheme(source: string, pluginId: string): ParsePluginThemeResult {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { theme: null, errors: [`invalid JSON: ${message}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { theme: null, errors: ['theme must be a JSON object'] };
  }

  const raw = parsed as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : pluginId;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id;
  const colorScheme =
    raw.colorScheme === 'light' || raw.colorScheme === 'dark' ? raw.colorScheme : null;
  if (!colorScheme) {
    errors.push('colorScheme must be "light" or "dark"');
  }
  if (!raw.tokens || typeof raw.tokens !== 'object' || Array.isArray(raw.tokens)) {
    errors.push('tokens must be an object of CSS variables');
    return { theme: null, errors };
  }

  const rawTokens = raw.tokens as Record<string, unknown>;
  if (Object.values(rawTokens).some(value => typeof value !== 'string')) {
    errors.push('tokens must map CSS variables to string values');
    return { theme: null, errors };
  }

  const tokens = validateThemeTokens(rawTokens as Record<string, string>, id);
  if (Object.keys(tokens).length === 0) {
    errors.push('no valid theme tokens');
    return { theme: null, errors };
  }

  if (!colorScheme) return { theme: null, errors };

  const theme: ThemeDefinition = {
    id,
    name,
    colorScheme,
    tokens,
    pluginId,
  };
  if (typeof raw.description === 'string') theme.description = raw.description;
  if (typeof raw.author === 'string') theme.author = raw.author;
  return { theme, errors };
}

export function createThemeOnlyManifest(id: string, name: string, version: string): PluginManifest {
  return { id, name, version, activate() {} };
}
