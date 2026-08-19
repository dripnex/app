import { describe, it, expect, beforeEach } from 'vitest';
import { pluginStyleStore } from '../src/theme/pluginStyleStore';

describe('pluginStyleStore', () => {
  beforeEach(() => {
    pluginStyleStore.getState().unregisterAll('hello');
    pluginStyleStore.getState().unregisterAll('other');
  });

  it('registers non-empty stylesheets', () => {
    pluginStyleStore.getState().register('hello', ['.a {}', '  ', '.b {}']);
    expect(pluginStyleStore.getState().sheets).toEqual([
      { pluginId: 'hello', sources: ['.a {}', '.b {}'] },
    ]);
  });

  it('replaces styles for the same plugin', () => {
    pluginStyleStore.getState().register('hello', ['.a {}']);
    pluginStyleStore.getState().register('hello', ['.b {}']);
    expect(pluginStyleStore.getState().sheets).toEqual([{ pluginId: 'hello', sources: ['.b {}'] }]);
  });

  it('drops a plugin with only blank sources', () => {
    pluginStyleStore.getState().register('hello', ['.a {}']);
    pluginStyleStore.getState().register('hello', ['  ']);
    expect(pluginStyleStore.getState().sheets).toEqual([]);
  });

  it('unregisters by plugin id', () => {
    pluginStyleStore.getState().register('hello', ['.a {}']);
    pluginStyleStore.getState().register('other', ['.b {}']);
    pluginStyleStore.getState().unregisterAll('hello');
    expect(pluginStyleStore.getState().sheets).toEqual([{ pluginId: 'other', sources: ['.b {}'] }]);
  });
});
