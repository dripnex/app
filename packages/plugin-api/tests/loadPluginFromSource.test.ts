import { describe, it, expect } from 'vitest';
import { loadPluginFromSource } from '../src/loader/loadPluginFromSource';

describe('loadPluginFromSource', () => {
  it('loads a valid CJS plugin', () => {
    const code = `
      module.exports = {
        id: 'hello',
        name: 'Hello',
        version: '1.0.0',
        activate() {},
      };
    `;
    const result = loadPluginFromSource(code, 'hello');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('hello');
    expect(result!.name).toBe('Hello');
    expect(typeof result!.activate).toBe('function');
  });

  it('returns null for ID mismatch', () => {
    const code = `
      module.exports = {
        id: 'wrong-id',
        name: 'Plugin',
        version: '1.0.0',
        activate() {},
      };
    `;
    const result = loadPluginFromSource(code, 'expected-id');
    expect(result).toBeNull();
  });

  it('returns null for invalid manifest', () => {
    const code = `
      module.exports = {
        id: 'test',
        name: '',
        version: 'bad',
      };
    `;
    const result = loadPluginFromSource(code, 'test');
    expect(result).toBeNull();
  });

  it('returns null for code that throws', () => {
    const code = `throw new Error('boom');`;
    const result = loadPluginFromSource(code, 'test');
    expect(result).toBeNull();
  });

  it('returns null for empty exports', () => {
    const code = `// nothing exported`;
    const result = loadPluginFromSource(code, 'test');
    expect(result).toBeNull();
  });

  it('supports exports shorthand', () => {
    const code = `
      exports.id = 'shorthand';
      exports.name = 'Shorthand';
      exports.version = '1.0.0';
      exports.activate = function() {};
    `;
    const result = loadPluginFromSource(code, 'shorthand');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('shorthand');
  });

  it('preserves optional fields', () => {
    const code = `
      module.exports = {
        id: 'full',
        name: 'Full Plugin',
        version: '2.0.0',
        description: 'A test plugin',
        activate() { return { dispose() {} }; },
        deactivate() {},
      };
    `;
    const result = loadPluginFromSource(code, 'full');
    expect(result).not.toBeNull();
    expect(result!.description).toBe('A test plugin');
    expect(typeof result!.deactivate).toBe('function');
  });
});
