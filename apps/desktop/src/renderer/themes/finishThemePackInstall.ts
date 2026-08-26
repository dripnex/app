import type { ThemeDefinition } from '@dripnex/plugin-api';

/**
 * Settings → Themes install-complete path.
 *
 * Harvest and activate in this window first, then ask other windows to
 * re-scan. Reload is a plugins:reload broadcast — not process.exit / app.quit.
 */
export async function finishThemePackInstall(input: {
  pluginId: string;
  refreshInstalled: () => Promise<void>;
  syncThemes: () => Promise<void>;
  themes: () => ThemeDefinition[];
  activate: (theme: ThemeDefinition) => void;
  notifyRefresh: () => void;
  requestReload: () => void;
}): Promise<ThemeDefinition | undefined> {
  input.notifyRefresh();
  await input.refreshInstalled();
  await input.syncThemes();
  const registered = input
    .themes()
    .find(t => t.pluginId === input.pluginId || t.id === input.pluginId);
  if (registered) input.activate(registered);
  input.requestReload();
  return registered;
}
