import { describe, expect, it, beforeEach } from 'vitest';
import { createMarkdownRenderer } from '../src/preview/createMarkdownRenderer.js';
import { remarkPluginStore } from '../src/preview/remarkPluginStore.js';
import { rehypePluginStore } from '../src/preview/rehypePluginStore.js';
import { previewComponentStore } from '../src/preview/previewComponentStore.js';
import { codeBlockStore } from '../src/preview/codeBlockStore.js';

describe('createMarkdownRenderer', () => {
  beforeEach(() => {
    remarkPluginStore.getState().unregisterAll('p1');
    rehypePluginStore.getState().unregisterAll('p1');
    previewComponentStore.getState().unregisterAll('p1');
    codeBlockStore.getState().unregisterAll('p1');
  });

  it('registers remark plugins on push and drops them on assign', () => {
    const md = createMarkdownRenderer('p1');
    const plugin = () => {};
    md.remarkPlugins.push(plugin);
    expect(remarkPluginStore.getState().registrations).toHaveLength(1);

    md.remarkPlugins = md.remarkPlugins.filter(item => item !== plugin);
    expect(remarkPluginStore.getState().registrations).toHaveLength(0);
  });

  it('registers rehype plugins the same way', () => {
    const md = createMarkdownRenderer('p1');
    const plugin = () => {};
    md.rehypePlugins.push(plugin);
    expect(rehypePluginStore.getState().registrations).toHaveLength(1);
    md.rehypePlugins = [];
    expect(rehypePluginStore.getState().registrations).toHaveLength(0);
  });

  it('maps remarkReactComponents and remarkCodeComponents onto the stores', () => {
    const md = createMarkdownRenderer('p1');
    const Anchor = () => null;
    const JsBlock = () => null;
    md.remarkReactComponents.a = Anchor;
    md.remarkCodeComponents.javascript = JsBlock;
    expect(previewComponentStore.getState().registrations[0]?.tagName).toBe('a');
    expect(codeBlockStore.getState().getRenderer('javascript')).toBe(JsBlock);
    delete md.remarkReactComponents.a;
    expect(previewComponentStore.getState().registrations).toHaveLength(0);
  });
});
