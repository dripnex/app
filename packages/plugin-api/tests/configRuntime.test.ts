import { describe, expect, it } from 'vitest';
import {
  applyPluginConfig,
  clearPluginConfig,
  getPluginConfig,
  observePluginConfig,
  resetPluginConfig,
} from '../src/lifecycle/configRuntime';

describe('configRuntime', () => {
  it('hydrates, observes, and ignores unchanged values', () => {
    resetPluginConfig('p', { enabled: false });
    expect(getPluginConfig('p', 'enabled')).toBe(false);

    const seen: unknown[] = [];
    const stop = observePluginConfig('p', 'enabled', value => {
      seen.push(value);
    });

    expect(applyPluginConfig('p', 'enabled', true)).toBe(true);
    expect(applyPluginConfig('p', 'enabled', true)).toBe(false);
    expect(seen).toEqual([true]);
    expect(getPluginConfig('p', 'enabled')).toBe(true);

    stop();
    applyPluginConfig('p', 'enabled', false);
    expect(seen).toEqual([true]);

    clearPluginConfig('p');
    expect(getPluginConfig('p', 'enabled')).toBeUndefined();
  });
});
