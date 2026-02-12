import { describe, it, expect, beforeEach } from 'vitest';
import { previewComponentStore } from '../src/preview/previewComponentStore';
import { codeBlockStore } from '../src/preview/codeBlockStore';

describe('previewComponentStore', () => {
  beforeEach(() => {
    const state = previewComponentStore.getState();
    for (const r of state.registrations) {
      state.unregister(r.id);
    }
  });

  it('starts with empty registrations', () => {
    expect(previewComponentStore.getState().registrations).toEqual([]);
  });

  it('registers a preview component', () => {
    const FakeComponent = () => null;
    previewComponentStore.getState().register({
      id: 'comp-1',
      pluginId: 'test-plugin',
      tagName: 'my-widget',
      component: FakeComponent,
    });

    expect(previewComponentStore.getState().registrations).toHaveLength(1);
    expect(previewComponentStore.getState().registrations[0]!.tagName).toBe('my-widget');
  });

  it('getComponents returns tagName -> component map', () => {
    const CompA = () => null;
    const CompB = () => null;

    previewComponentStore.getState().register({
      id: 'comp-1',
      pluginId: 'plugin-a',
      tagName: 'table',
      component: CompA,
    });
    previewComponentStore.getState().register({
      id: 'comp-2',
      pluginId: 'plugin-b',
      tagName: 'blockquote',
      component: CompB,
    });

    const components = previewComponentStore.getState().getComponents();
    expect(components['table']).toBe(CompA);
    expect(components['blockquote']).toBe(CompB);
  });

  it('unregisterAll removes all for a pluginId', () => {
    previewComponentStore.getState().register({
      id: 'comp-1',
      pluginId: 'plugin-a',
      tagName: 'table',
      component: () => null,
    });
    previewComponentStore.getState().register({
      id: 'comp-2',
      pluginId: 'plugin-b',
      tagName: 'blockquote',
      component: () => null,
    });

    previewComponentStore.getState().unregisterAll('plugin-a');

    expect(previewComponentStore.getState().registrations).toHaveLength(1);
    expect(previewComponentStore.getState().registrations[0]!.pluginId).toBe('plugin-b');
  });
});

describe('codeBlockStore', () => {
  beforeEach(() => {
    const state = codeBlockStore.getState();
    for (const r of state.registrations) {
      state.unregister(r.id);
    }
  });

  it('starts with empty registrations', () => {
    expect(codeBlockStore.getState().registrations).toEqual([]);
  });

  it('registers a code block renderer', () => {
    const MermaidRenderer = () => null;
    codeBlockStore.getState().register({
      id: 'mermaid-renderer',
      pluginId: 'mermaid-plugin',
      language: 'mermaid',
      component: MermaidRenderer,
    });

    expect(codeBlockStore.getState().registrations).toHaveLength(1);
    expect(codeBlockStore.getState().registrations[0]!.language).toBe('mermaid');
  });

  it('getRenderer returns component for matching language', () => {
    const MermaidRenderer = () => null;
    codeBlockStore.getState().register({
      id: 'mermaid-renderer',
      pluginId: 'mermaid-plugin',
      language: 'mermaid',
      component: MermaidRenderer,
    });

    expect(codeBlockStore.getState().getRenderer('mermaid')).toBe(MermaidRenderer);
    expect(codeBlockStore.getState().getRenderer('python')).toBeUndefined();
  });

  it('replaces registration with same id', () => {
    codeBlockStore.getState().register({
      id: 'renderer-1',
      pluginId: 'test-plugin',
      language: 'mermaid',
      component: () => null,
    });
    const NewRenderer = () => null;
    codeBlockStore.getState().register({
      id: 'renderer-1',
      pluginId: 'test-plugin',
      language: 'mermaid',
      component: NewRenderer,
    });

    expect(codeBlockStore.getState().registrations).toHaveLength(1);
    expect(codeBlockStore.getState().getRenderer('mermaid')).toBe(NewRenderer);
  });

  it('unregisterAll removes all for a pluginId', () => {
    codeBlockStore.getState().register({
      id: 'renderer-1',
      pluginId: 'plugin-a',
      language: 'mermaid',
      component: () => null,
    });
    codeBlockStore.getState().register({
      id: 'renderer-2',
      pluginId: 'plugin-a',
      language: 'chart',
      component: () => null,
    });
    codeBlockStore.getState().register({
      id: 'renderer-3',
      pluginId: 'plugin-b',
      language: 'math',
      component: () => null,
    });

    codeBlockStore.getState().unregisterAll('plugin-a');

    expect(codeBlockStore.getState().registrations).toHaveLength(1);
    expect(codeBlockStore.getState().registrations[0]!.pluginId).toBe('plugin-b');
  });
});
