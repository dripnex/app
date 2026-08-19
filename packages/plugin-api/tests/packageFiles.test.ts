import { describe, it, expect, beforeEach } from 'vitest';
import { parsePluginChord } from '../src/packageFiles/chords';
import { parsePluginKeymap, qualifyPluginCommandId } from '../src/packageFiles/parsePluginKeymap';
import { parsePluginMenus } from '../src/packageFiles/parsePluginMenus';
import { applyPluginPackageFiles } from '../src/packageFiles/applyPluginPackageFiles';
import { pluginMenuStore } from '../src/menu/pluginMenuStore';
import { pluginContextMenuStore } from '../src/menu/pluginContextMenuStore';

describe('parsePluginChord', () => {
  it('parses plus and hyphen chords', () => {
    expect(parsePluginChord('Mod+Shift+H')).toEqual({
      key: 'h',
      modifiers: ['Mod', 'Shift'],
    });
    expect(parsePluginChord('ctrl-alt-n')).toEqual({
      key: 'n',
      modifiers: ['Mod', 'Alt'],
    });
  });
});

describe('qualifyPluginCommandId', () => {
  it('prefixes local and plugin-scoped ids', () => {
    expect(qualifyPluginCommandId('hello', 'say-hello')).toBe('plugin:hello:say-hello');
    expect(qualifyPluginCommandId('hello', 'hello:say-hello')).toBe('plugin:hello:say-hello');
    expect(qualifyPluginCommandId('hello', 'plugin:hello:say-hello')).toBe(
      'plugin:hello:say-hello'
    );
    expect(qualifyPluginCommandId('hello', 'app:new-note')).toBe('app:new-note');
  });
});

describe('parsePluginKeymap', () => {
  it('parses dripnex command → chord maps', () => {
    const { bindings, errors } = parsePluginKeymap('{ "say-hello": "Mod+Shift+H" }', 'hello');
    expect(errors).toEqual([]);
    expect(bindings).toEqual([
      {
        commandId: 'plugin:hello:say-hello',
        keybinding: { key: 'h', modifiers: ['Mod', 'Shift'] },
      },
    ]);
  });

  it('parses Inkdrop selector maps', () => {
    const { bindings, errors } = parsePluginKeymap(
      '{ "body": { "ctrl-alt-n": "hello:say" } }',
      'hello'
    );
    expect(errors).toEqual([]);
    expect(bindings[0]?.commandId).toBe('plugin:hello:say');
    expect(bindings[0]?.keybinding).toEqual({ key: 'n', modifiers: ['Mod', 'Alt'] });
  });
});

describe('parsePluginMenus', () => {
  it('flattens submenu trees and maps context targets', () => {
    const { menu, contextMenu, errors } = parsePluginMenus(
      JSON.stringify({
        menu: [
          {
            label: 'Plugins',
            submenu: [{ label: 'Hello', command: 'say-hello' }],
          },
        ],
        'context-menu': {
          '.note-list-item-view': [{ label: 'Hello', command: 'say-hello' }],
        },
      }),
      'hello'
    );
    expect(errors).toEqual([]);
    expect(menu).toEqual([
      { label: 'Hello', commandId: 'plugin:hello:say-hello', accelerator: undefined },
    ]);
    expect(contextMenu).toEqual([
      {
        target: 'note-list-item',
        label: 'Hello',
        commandId: 'plugin:hello:say-hello',
        accelerator: undefined,
      },
    ]);
  });
});

describe('applyPluginPackageFiles', () => {
  beforeEach(() => {
    pluginMenuStore.getState().removeAll('hello');
    pluginContextMenuStore.getState().removeAll('hello');
  });

  it('adds menus and binds plugin commands only', () => {
    const bound: string[] = [];
    const result = applyPluginPackageFiles(
      'hello',
      {
        menus: [
          JSON.stringify({
            menu: [{ label: 'Hello', command: 'say-hello' }],
            'context-menu': {
              'note-list-item': [{ label: 'Hello', command: 'say-hello' }],
            },
          }),
        ],
        keymaps: [
          JSON.stringify({
            'say-hello': 'Mod+Shift+H',
            'app:new-note': 'Mod+Alt+N',
          }),
        ],
      },
      {
        setDefaultKeybinding(commandId) {
          bound.push(commandId);
          return commandId === 'plugin:hello:say-hello';
        },
      }
    );

    expect(result.menuCount).toBe(1);
    expect(result.contextMenuCount).toBe(1);
    expect(result.keymapCount).toBe(1);
    expect(bound).toEqual(['plugin:hello:say-hello']);
    expect(result.errors.some(e => e.includes('app:new-note'))).toBe(true);
    expect(pluginMenuStore.getState().items).toHaveLength(1);
    expect(pluginContextMenuStore.getState().items[0]?.target).toBe('note-list-item');
  });
});
