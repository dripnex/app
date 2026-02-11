import { describe, it, expect, beforeEach } from 'vitest';
import { layoutStore, createLayoutManager } from '../src/layout/layoutStore';
import type { LayoutZoneName } from '../src/layout/types';

describe('layoutStore', () => {
  beforeEach(() => {
    // Clear all zones
    const state = layoutStore.getState();
    for (const [zone] of state.zones) {
      const entries = state.getZone(zone);
      for (const e of entries) {
        state.removeEntry(e.id);
      }
    }
  });

  it('starts with empty zones', () => {
    expect(layoutStore.getState().getZone('editor-status-bar')).toEqual([]);
  });

  it('adds an entry to a zone', () => {
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'entry-1',
      pluginId: 'plugin-a',
      component: () => null,
      order: 10,
    });

    const entries = layoutStore.getState().getZone('editor-status-bar');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe('entry-1');
  });

  it('replaces entry with same id', () => {
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'entry-1',
      pluginId: 'plugin-a',
      component: () => null,
      order: 10,
    });
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'entry-1',
      pluginId: 'plugin-a',
      component: () => null,
      order: 20,
    });

    const entries = layoutStore.getState().getZone('editor-status-bar');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.order).toBe(20);
  });

  it('sorts entries by order', () => {
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'b',
      pluginId: 'plugin-a',
      component: () => null,
      order: 20,
    });
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'a',
      pluginId: 'plugin-a',
      component: () => null,
      order: 5,
    });

    const entries = layoutStore.getState().getZone('editor-status-bar');
    expect(entries[0]!.id).toBe('a');
    expect(entries[1]!.id).toBe('b');
  });

  it('removeEntry removes by id across zones', () => {
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'entry-1',
      pluginId: 'plugin-a',
      component: () => null,
      order: 10,
    });
    layoutStore.getState().removeEntry('entry-1');

    expect(layoutStore.getState().getZone('editor-status-bar')).toEqual([]);
  });

  it('removeAllForPlugin removes all entries for a pluginId', () => {
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'e1',
      pluginId: 'plugin-a',
      component: () => null,
      order: 10,
    });
    layoutStore.getState().addEntry('panel', {
      id: 'e2',
      pluginId: 'plugin-a',
      component: () => null,
      order: 10,
    });
    layoutStore.getState().addEntry('editor-status-bar', {
      id: 'e3',
      pluginId: 'plugin-b',
      component: () => null,
      order: 10,
    });

    layoutStore.getState().removeAllForPlugin('plugin-a');

    expect(layoutStore.getState().getZone('editor-status-bar')).toHaveLength(1);
    expect(layoutStore.getState().getZone('editor-status-bar')[0]!.pluginId).toBe('plugin-b');
    expect(layoutStore.getState().getZone('panel' as LayoutZoneName)).toEqual([]);
  });
});

describe('createLayoutManager', () => {
  beforeEach(() => {
    const state = layoutStore.getState();
    for (const [zone] of state.zones) {
      const entries = state.getZone(zone);
      for (const e of entries) {
        state.removeEntry(e.id);
      }
    }
  });

  it('addComponent scopes to pluginId', () => {
    const manager = createLayoutManager('my-plugin');
    manager.addComponent('editor-status-bar', {
      id: 'widget',
      component: () => null,
      order: 10,
    });

    const entries = layoutStore.getState().getZone('editor-status-bar');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.pluginId).toBe('my-plugin');
  });

  it('removeComponent removes by id', () => {
    const manager = createLayoutManager('my-plugin');
    manager.addComponent('editor-status-bar', {
      id: 'widget',
      component: () => null,
      order: 10,
    });
    manager.removeComponent('widget');

    expect(layoutStore.getState().getZone('editor-status-bar')).toEqual([]);
  });

  it('removeAllForPlugin cleans up all entries', () => {
    const manager = createLayoutManager('my-plugin');
    manager.addComponent('editor-status-bar', {
      id: 'w1',
      component: () => null,
      order: 10,
    });
    manager.addComponent('panel', {
      id: 'w2',
      component: () => null,
      order: 10,
    });
    manager.removeAllForPlugin('my-plugin');

    expect(layoutStore.getState().getZone('editor-status-bar')).toEqual([]);
    expect(layoutStore.getState().getZone('panel' as LayoutZoneName)).toEqual([]);
  });
});
