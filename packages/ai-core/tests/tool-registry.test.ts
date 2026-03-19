import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../src/tool-registry';
import type { ToolRegistration } from '../src/tool-registry';

function createTool(overrides: Partial<ToolRegistration> = {}): ToolRegistration {
  return {
    name: 'search_notes',
    description: 'Search notes by query',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    execute: vi.fn().mockResolvedValue({ ok: true, content: '[]' }),
    requiresConfirmation: false,
    ...overrides,
  };
}

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    const registry = new ToolRegistry();
    registry.register(createTool());
    expect(registry.get('search_notes')).toBeDefined();
    expect(registry.has('search_notes')).toBe(true);
  });

  it('returns undefined for unknown tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.has('unknown')).toBe(false);
  });

  it('unregister removes the tool', () => {
    const registry = new ToolRegistry();
    const unregister = registry.register(createTool());
    expect(registry.has('search_notes')).toBe(true);
    unregister();
    expect(registry.has('search_notes')).toBe(false);
  });

  it('getDefinitions returns only name, description, parameters', () => {
    const registry = new ToolRegistry();
    registry.register(createTool());
    registry.register(createTool({ name: 'read_note', description: 'Read a note' }));
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs[0]).toEqual({
      name: 'search_notes',
      description: 'Search notes by query',
      parameters: expect.any(Object),
    });
    // Should NOT contain execute or requiresConfirmation
    expect(defs[0]).not.toHaveProperty('execute');
    expect(defs[0]).not.toHaveProperty('requiresConfirmation');
  });

  it('throws on duplicate registration', () => {
    const registry = new ToolRegistry();
    registry.register(createTool());
    expect(() => registry.register(createTool())).toThrow('already registered');
  });

  it('allows re-registration after unregister', () => {
    const registry = new ToolRegistry();
    const unregister = registry.register(createTool());
    unregister();
    expect(() => registry.register(createTool())).not.toThrow();
  });
});
