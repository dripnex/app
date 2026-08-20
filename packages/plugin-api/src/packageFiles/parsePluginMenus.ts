import type { PluginContextMenuTarget } from '../menu/pluginContextMenuStore';
import { qualifyPluginCommandId } from './parsePluginKeymap';

export interface PluginPackageMenuItem {
  label: string;
  commandId: string;
  accelerator?: string;
}

export interface PluginPackageContextMenuItem extends PluginPackageMenuItem {
  target: PluginContextMenuTarget;
}

export interface ParsePluginMenusResult {
  menu: PluginPackageMenuItem[];
  contextMenu: PluginPackageContextMenuItem[];
  errors: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asItem(value: unknown): { label: string; command?: string; accelerator?: string } | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.label !== 'string' || !value.label.trim()) return null;
  return {
    label: value.label.trim(),
    command: typeof value.command === 'string' ? value.command : undefined,
    accelerator: typeof value.accelerator === 'string' ? value.accelerator : undefined,
  };
}

function flattenMenu(
  pluginId: string,
  nodes: unknown[],
  out: PluginPackageMenuItem[],
  errors: string[],
  path: string
): void {
  nodes.forEach((node, index) => {
    const here = `${path}[${index}]`;
    if (!isPlainObject(node)) {
      errors.push(`${here}: expected a menu item object`);
      return;
    }
    if (Array.isArray(node.submenu)) {
      flattenMenu(pluginId, node.submenu, out, errors, `${here}.submenu`);
      return;
    }
    const item = asItem(node);
    if (!item?.command) {
      if (item && !item.command) return;
      errors.push(`${here}: expected label + command`);
      return;
    }
    out.push({
      label: item.label,
      commandId: qualifyPluginCommandId(pluginId, item.command),
      accelerator: item.accelerator,
    });
  });
}

const TARGET_ALIASES: Record<string, PluginContextMenuTarget> = {
  'note-list-item': 'note-list-item',
  'note-list': 'note-list-item',
  '.note-list-item': 'note-list-item',
  '.note-list-item-view': 'note-list-item',
  'notebook-item': 'notebook-item',
  notebook: 'notebook-item',
  '.sidebar-menu-item-notebook': 'notebook-item',
  'tag-item': 'tag-item',
  tag: 'tag-item',
  '.sidebar-menu-item-tag': 'tag-item',
  editor: 'editor',
  '.cm-editor': 'editor',
  '.codemirror': 'editor',
};

function resolveTarget(selector: string): PluginContextMenuTarget | null {
  const key = selector.trim().toLowerCase();
  if (TARGET_ALIASES[key]) return TARGET_ALIASES[key] ?? null;
  if (key.includes('note-list')) return 'note-list-item';
  if (key.includes('notebook')) return 'notebook-item';
  if (key.includes('tag')) return 'tag-item';
  if (key.includes('editor') || key.includes('codemirror') || key.includes('cm-')) {
    return 'editor';
  }
  return null;
}

/**
 * Plugin package menus.
 *
 * `{ "menu": [{ "label": "Hello", "command": "say-hello" }],
 *    "context-menu": { "note-list-item": [{ "label": "Hello", "command": "say-hello" }] } }`
 */
export function parsePluginMenus(source: string, pluginId: string): ParsePluginMenusResult {
  const menu: PluginPackageMenuItem[] = [];
  const contextMenu: PluginPackageContextMenuItem[] = [];
  const errors: string[] = [];
  const trimmed = source.trim();
  if (!trimmed) return { menu, contextMenu, errors };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { menu, contextMenu, errors: [`Invalid JSON: ${message}`] };
  }

  if (!isPlainObject(parsed)) {
    return { menu, contextMenu, errors: ['Menus file must be a JSON object'] };
  }

  if (Array.isArray(parsed.menu)) {
    flattenMenu(pluginId, parsed.menu, menu, errors, 'menu');
  } else if (parsed.menu !== undefined) {
    errors.push('menu: expected an array');
  }

  const ctx = parsed['context-menu'] ?? parsed.contextMenu;
  if (ctx !== undefined) {
    if (!isPlainObject(ctx)) {
      errors.push('context-menu: expected an object of target → items');
    } else {
      for (const [selector, items] of Object.entries(ctx)) {
        const target = resolveTarget(selector);
        if (!target) {
          errors.push(`context-menu."${selector}": unknown target`);
          continue;
        }
        if (!Array.isArray(items)) {
          errors.push(`context-menu."${selector}": expected an array`);
          continue;
        }
        for (const [index, raw] of items.entries()) {
          const item = asItem(raw);
          if (!item?.command) {
            errors.push(`context-menu."${selector}"[${index}]: expected label + command`);
            continue;
          }
          contextMenu.push({
            target,
            label: item.label,
            commandId: qualifyPluginCommandId(pluginId, item.command),
            accelerator: item.accelerator,
          });
        }
      }
    }
  }

  return { menu, contextMenu, errors };
}
