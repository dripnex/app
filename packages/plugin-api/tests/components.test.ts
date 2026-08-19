import { describe, expect, it } from 'vitest';
import { pluginComponents } from '../src/components/catalog.js';

describe('pluginComponents', () => {
  it('exposes Button, Modal, and Dialog', () => {
    expect(pluginComponents.get('Button')).toBe(pluginComponents.Button);
    expect(pluginComponents.get('Modal')).toBe(pluginComponents.Modal);
    expect(pluginComponents.get('Dialog')).toBe(pluginComponents.Dialog);
    expect(pluginComponents.getComponentClass('Dialog')).toBe(pluginComponents.Dialog);
    expect(pluginComponents.get('NotebookListBar')).toBeUndefined();
  });
});
