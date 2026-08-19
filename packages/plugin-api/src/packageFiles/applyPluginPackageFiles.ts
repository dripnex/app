import { pluginContextMenuStore } from '../menu/pluginContextMenuStore';
import { pluginMenuStore } from '../menu/pluginMenuStore';
import { parsePluginKeymap, type PluginKeymapBinding } from './parsePluginKeymap';
import { parsePluginMenus } from './parsePluginMenus';

export interface PluginPackageFiles {
  keymaps: string[];
  menus: string[];
}

export interface ApplyPackageFilesOptions {
  setDefaultKeybinding?: (
    commandId: string,
    keybinding: PluginKeymapBinding['keybinding']
  ) => boolean;
}

export interface ApplyPackageFilesResult {
  menuCount: number;
  contextMenuCount: number;
  keymapCount: number;
  errors: string[];
}

/**
 * Apply declarative keymaps/*.json and menus/*.json after activate().
 * Only binds chords on commands the plugin already registered (`plugin:<id>:`).
 */
export function applyPluginPackageFiles(
  pluginId: string,
  files: PluginPackageFiles,
  options: ApplyPackageFilesOptions = {}
): ApplyPackageFilesResult {
  const errors: string[] = [];
  let menuCount = 0;
  let contextMenuCount = 0;
  let keymapCount = 0;

  for (const [index, source] of files.menus.entries()) {
    const parsed = parsePluginMenus(source, pluginId);
    for (const err of parsed.errors) {
      errors.push(`menus[${index}]: ${err}`);
    }
    for (const item of parsed.menu) {
      pluginMenuStore.getState().add({
        pluginId,
        label: item.label,
        commandId: item.commandId,
        accelerator: item.accelerator,
      });
      menuCount += 1;
    }
    for (const item of parsed.contextMenu) {
      pluginContextMenuStore.getState().add({
        pluginId,
        target: item.target,
        label: item.label,
        commandId: item.commandId,
      });
      contextMenuCount += 1;
    }
  }

  const prefix = `plugin:${pluginId}:`;
  for (const [index, source] of files.keymaps.entries()) {
    const parsed = parsePluginKeymap(source, pluginId);
    for (const err of parsed.errors) {
      errors.push(`keymaps[${index}]: ${err}`);
    }
    for (const binding of parsed.bindings) {
      if (!binding.commandId.startsWith(prefix)) {
        errors.push(`keymaps[${index}]: skipped core command "${binding.commandId}"`);
        continue;
      }
      if (!options.setDefaultKeybinding) continue;
      const ok = options.setDefaultKeybinding(binding.commandId, binding.keybinding);
      if (!ok) {
        errors.push(`keymaps[${index}]: command "${binding.commandId}" is not registered`);
        continue;
      }
      keymapCount += 1;
    }
  }

  return { menuCount, contextMenuCount, keymapCount, errors };
}
