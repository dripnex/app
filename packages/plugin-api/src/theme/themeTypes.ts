/**
 * Theme System Types
 *
 * Defines ThemeDefinition and the token whitelist for validation.
 */

/** Core CSS tokens that themes are allowed to override */
export const CORE_THEME_TOKENS = [
  '--bg-base',
  '--bg-surface',
  '--bg-elevated',
  '--bg-inset',
  '--bg-hover',
  '--bg-active',
  '--accent',
  '--accent-hover',
  '--accent-muted',
  '--accent-subtle',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-faint',
  '--border',
  '--border-subtle',
  '--border-strong',
  '--glass-bg',
  '--glass-border',
  '--glass-bg-menu',
  '--glass-border-menu',
  '--danger',
  '--danger-muted',
  '--warning',
  '--warning-muted',
  '--success',
  '--success-muted',
  '--status-active',
  '--status-on-hold',
  '--status-completed',
  '--status-dropped',
] as const;

/** Valid extension scope prefixes for non-core tokens */
export const THEME_EXTENSION_SCOPES = ['--syntax-', '--preview-', '--ui-'] as const;

/** A complete theme definition */
export interface ThemeDefinition {
  id: string;
  name: string;
  description?: string;
  author?: string;
  colorScheme: 'dark' | 'light';
  tokens: Record<string, string>;
  pluginId?: string;
}

/** Check if a token name is in the whitelist or a valid extension scope */
export function isValidThemeToken(token: string): boolean {
  if ((CORE_THEME_TOKENS as readonly string[]).includes(token)) return true;
  return THEME_EXTENSION_SCOPES.some(prefix => token.startsWith(prefix));
}

/** Validate and filter tokens. Returns only valid ones, warns about rejected. */
export function validateThemeTokens(
  tokens: Record<string, string>,
  themeId: string
): Record<string, string> {
  const valid: Record<string, string> = {};
  for (const [token, value] of Object.entries(tokens)) {
    if (isValidThemeToken(token)) {
      valid[token] = value;
    } else {
      console.warn(`[ThemeRegistry] Theme "${themeId}": rejected invalid token "${token}"`);
    }
  }
  return valid;
}
