/**
 * Settings sidebar items, in display order.
 *
 * Nested plugin pages (`plugins-install`, `plugins-updates`) are not
 * top-level nav items; they hang off Plugins in the sidebar.
 */

export const SETTINGS_NAV_ITEMS = [
  { id: 'general', label: 'General' },
  { id: 'editor', label: 'Editor' },
  { id: 'themes', label: 'Themes' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'ai', label: 'AI Assistant' },
  { id: 'keybindings', label: 'Keybindings' },
  { id: 'hack', label: 'Hack' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'account', label: 'Account' },
  { id: 'encryption', label: 'Encryption' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'backup', label: 'Backup & Data' },
  { id: 'updates', label: 'Updates' },
  { id: 'about', label: 'About' },
] as const;

export type SettingsNavId = (typeof SETTINGS_NAV_ITEMS)[number]['id'];

export type SettingsSection = SettingsNavId | 'plugins-install' | 'plugins-updates';
