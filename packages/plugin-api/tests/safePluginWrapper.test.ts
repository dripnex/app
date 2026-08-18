import { describe, expect, it } from 'vitest';
import { safePluginWrapper } from '../src/preview/safePluginWrapper';

const meta = { name: 'Math', version: '1.0.0', pluginId: 'math' };

describe('safePluginWrapper', () => {
  it('forwards this so unified attachers can read processor.data', () => {
    const processor = { data: () => ({ ok: true }) };
    function attacher(this: { data: () => { ok: boolean } }) {
      if (!this?.data) throw new Error('missing this.data');
      return () => undefined;
    }

    const wrapped = safePluginWrapper(attacher, meta) as (this: unknown) => unknown;
    expect(() => wrapped.call(processor)).not.toThrow();
  });

  it('returns a no-op when the attacher throws', () => {
    function boom() {
      throw new Error('nope');
    }
    const wrapped = safePluginWrapper(boom, meta) as () => unknown;
    const transformer = wrapped();
    expect(typeof transformer).toBe('function');
  });
});
