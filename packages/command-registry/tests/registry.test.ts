import { describe, it, expect } from 'vitest';
import {
  CommandRegistry,
  serializeKeybinding,
  keybindingsMatch,
  formatKeybinding,
} from '../src/registry';
import type { RegisteredCommand } from '../src/types';

function makeCommand(overrides: Partial<RegisteredCommand> = {}): RegisteredCommand {
  return {
    id: 'test:command',
    name: 'Test Command',
    category: 'app',
    context: 'app',
    execute: () => true,
    ...overrides,
  };
}

describe('CommandRegistry', () => {
  it('registers and retrieves commands', () => {
    const reg = new CommandRegistry();
    const cmd = makeCommand({ id: 'foo' });
    reg.register(cmd);

    expect(reg.get('foo')).toBe(cmd);
    expect(reg.getAll()).toHaveLength(1);
  });

  it('unregisters commands', () => {
    const reg = new CommandRegistry();
    reg.register(makeCommand({ id: 'foo' }));
    reg.unregister('foo');

    expect(reg.get('foo')).toBeUndefined();
    expect(reg.getAll()).toHaveLength(0);
  });

  it('register returns unregister function', () => {
    const reg = new CommandRegistry();
    const unregister = reg.register(makeCommand({ id: 'foo' }));
    expect(reg.getAll()).toHaveLength(1);

    unregister();
    expect(reg.getAll()).toHaveLength(0);
  });

  it('dispatches commands', async () => {
    const reg = new CommandRegistry();
    let called = false;
    reg.register(
      makeCommand({
        id: 'foo',
        execute: () => {
          called = true;
        },
      })
    );

    const result = await reg.dispatch('foo');
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  it('dispatch returns false for non-existent command', async () => {
    const reg = new CommandRegistry();
    expect(await reg.dispatch('nope')).toBe(false);
  });

  it('dispatch returns false for disabled command', async () => {
    const reg = new CommandRegistry();
    reg.register(makeCommand({ id: 'foo', enabled: false }));
    expect(await reg.dispatch('foo')).toBe(false);
  });

  it('filters by category', () => {
    const reg = new CommandRegistry();
    reg.register(makeCommand({ id: 'a', category: 'editor' }));
    reg.register(makeCommand({ id: 'b', category: 'app' }));
    reg.register(makeCommand({ id: 'c', category: 'editor' }));

    expect(reg.getByCategory('editor')).toHaveLength(2);
    expect(reg.getByCategory('app')).toHaveLength(1);
  });

  it('finds command by keybinding', () => {
    const reg = new CommandRegistry();
    reg.register(
      makeCommand({
        id: 'bold',
        context: 'editor',
        defaultKeybinding: { key: 'b', modifiers: ['Mod'] },
      })
    );

    const found = reg.findByKeybinding({ key: 'b', modifiers: ['Mod'] }, 'editor');
    expect(found?.id).toBe('bold');
  });

  it('respects keybinding overrides', () => {
    const reg = new CommandRegistry();
    reg.register(
      makeCommand({
        id: 'bold',
        defaultKeybinding: { key: 'b', modifiers: ['Mod'] },
      })
    );

    reg.setKeybindingOverride({
      commandId: 'bold',
      keybinding: { key: 'b', modifiers: ['Mod', 'Shift'] },
    });

    expect(reg.getKeybinding('bold')).toEqual({ key: 'b', modifiers: ['Mod', 'Shift'] });
  });

  it('replaceKeybindingOverrides replaces the whole map', () => {
    const reg = new CommandRegistry();
    reg.register(
      makeCommand({
        id: 'bold',
        defaultKeybinding: { key: 'b', modifiers: ['Mod'] },
      })
    );
    reg.setKeybindingOverride({
      commandId: 'bold',
      keybinding: { key: 'x', modifiers: ['Mod'] },
    });
    reg.replaceKeybindingOverrides([
      { commandId: 'bold', keybinding: { key: 'i', modifiers: ['Mod'] } },
    ]);
    expect(reg.getKeybinding('bold')).toEqual({ key: 'i', modifiers: ['Mod'] });
    reg.replaceKeybindingOverrides([]);
    expect(reg.getKeybinding('bold')).toEqual({ key: 'b', modifiers: ['Mod'] });
  });

  it('dispatch returns false when execute throws', async () => {
    const reg = new CommandRegistry();
    reg.register(
      makeCommand({
        id: 'boom',
        execute: () => {
          throw new Error('nope');
        },
      })
    );
    expect(await reg.dispatch('boom')).toBe(false);
  });

  it('detects a global binding overlapping another context', () => {
    const reg = new CommandRegistry();
    reg.register(
      makeCommand({
        id: 'global-save',
        context: 'global',
        defaultKeybinding: { key: 's', modifiers: ['Mod'] },
      })
    );
    reg.register(
      makeCommand({
        id: 'editor-save',
        context: 'editor',
        defaultKeybinding: { key: 's', modifiers: ['Mod'] },
      })
    );
    const conflicts = reg.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.commands.map(c => c.id).sort()).toEqual(['editor-save', 'global-save']);
  });

  it('detects conflicts', () => {
    const reg = new CommandRegistry();
    reg.register(
      makeCommand({
        id: 'a',
        context: 'editor',
        defaultKeybinding: { key: 'b', modifiers: ['Mod'] },
      })
    );
    reg.register(
      makeCommand({
        id: 'b',
        context: 'editor',
        defaultKeybinding: { key: 'b', modifiers: ['Mod'] },
      })
    );

    const conflicts = reg.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.commands).toHaveLength(2);
  });

  it('notifies subscribers', () => {
    const reg = new CommandRegistry();
    let count = 0;
    reg.subscribe(() => {
      count++;
    });

    reg.register(makeCommand({ id: 'a' }));
    expect(count).toBe(1);

    reg.unregister('a');
    expect(count).toBe(2);
  });
});

describe('keybinding utilities', () => {
  it('serializes keybindings consistently', () => {
    expect(serializeKeybinding({ key: 'b', modifiers: ['Mod'] })).toBe('Mod+b');
    expect(serializeKeybinding({ key: 'b', modifiers: ['Shift', 'Mod'] })).toBe('Mod+Shift+b');
    expect(serializeKeybinding({ key: 'B', modifiers: ['Mod'] })).toBe('Mod+b');
  });

  it('matches keybindings', () => {
    expect(
      keybindingsMatch({ key: 'b', modifiers: ['Mod'] }, { key: 'B', modifiers: ['Mod'] })
    ).toBe(true);

    expect(
      keybindingsMatch(
        { key: 'b', modifiers: ['Mod', 'Shift'] },
        { key: 'b', modifiers: ['Shift', 'Mod'] }
      )
    ).toBe(true);

    expect(
      keybindingsMatch({ key: 'b', modifiers: ['Mod'] }, { key: 'i', modifiers: ['Mod'] })
    ).toBe(false);
  });

  it('formats keybindings', () => {
    const result = formatKeybinding({ key: 'b', modifiers: ['Mod'] });
    // Result depends on platform: Mac uses ⌘B, others use Ctrl+B
    expect(['⌘B', 'Ctrl+B']).toContain(result);
  });

  it('returns empty string for undefined keybinding', () => {
    expect(formatKeybinding(undefined)).toBe('');
  });
});
