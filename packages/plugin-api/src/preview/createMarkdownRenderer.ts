import type { ComponentType } from 'react';
import { remarkPluginStore } from './remarkPluginStore.js';
import { rehypePluginStore } from './rehypePluginStore.js';
import { previewComponentStore } from './previewComponentStore.js';
import { codeBlockStore } from './codeBlockStore.js';
import type { CodeBlockRendererProps } from './codeBlockStore.js';
import {
  previewEventStore,
  type PreviewEventHandler,
  type PreviewEventName,
} from './previewEventStore.js';

export interface MarkdownRenderer {
  remarkPlugins: unknown[];
  rehypePlugins: unknown[];
  remarkReactComponents: Record<string, ComponentType>;
  remarkCodeComponents: Record<string, ComponentType<CodeBlockRendererProps>>;
  events: {
    on(event: PreviewEventName, handler: PreviewEventHandler): () => void;
  };
}

function trackedList(onChange: (items: unknown[]) => void): unknown[] {
  const items: unknown[] = [];
  const notify = () => onChange(items.slice());
  for (const method of ['push', 'pop', 'shift', 'unshift', 'splice'] as const) {
    const orig = Array.prototype[method] as (...args: unknown[]) => unknown;
    Object.defineProperty(items, method, {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) => {
        const result = orig.apply(items, args);
        notify();
        return result;
      },
    });
  }
  return items;
}

/**
 * Inkdrop `markdownRenderer` — remark/rehype arrays, React element map,
 * fenced-code map, and preview events. Backed by the existing stores.
 */
export function createMarkdownRenderer(pluginId: string): MarkdownRenderer {
  let remarkSeq = 0;
  let rehypeSeq = 0;
  const remarkIds: string[] = [];
  const rehypeIds: string[] = [];

  const syncRemark = (plugins: unknown[]) => {
    for (const id of remarkIds) remarkPluginStore.getState().unregister(id);
    remarkIds.length = 0;
    for (const plugin of plugins) {
      const id = `${pluginId}:md-remark:${++remarkSeq}`;
      remarkIds.push(id);
      remarkPluginStore.getState().register({
        id,
        pluginId,
        plugin,
        metadata: { name: pluginId, version: '0', priority: 100 },
      });
    }
  };

  const syncRehype = (plugins: unknown[]) => {
    for (const id of rehypeIds) rehypePluginStore.getState().unregister(id);
    rehypeIds.length = 0;
    for (const plugin of plugins) {
      const id = `${pluginId}:md-rehype:${++rehypeSeq}`;
      rehypeIds.push(id);
      rehypePluginStore.getState().register({
        id,
        pluginId,
        plugin,
        metadata: { name: pluginId, version: '0', priority: 100 },
      });
    }
  };

  const remarkPlugins = trackedList(syncRemark);
  const rehypePlugins = trackedList(syncRehype);

  const remarkReactComponents = new Proxy({} as Record<string, ComponentType>, {
    set(target, prop, value) {
      if (typeof prop !== 'string') return false;
      target[prop] = value as ComponentType;
      previewComponentStore.getState().register({
        id: `${pluginId}:el:${prop}`,
        pluginId,
        tagName: prop,
        component: value as ComponentType,
      });
      return true;
    },
    deleteProperty(target, prop) {
      if (typeof prop !== 'string') return false;
      delete target[prop];
      previewComponentStore.getState().unregister(`${pluginId}:el:${prop}`);
      return true;
    },
  });

  const remarkCodeComponents = new Proxy(
    {} as Record<string, ComponentType<CodeBlockRendererProps>>,
    {
      set(target, prop, value) {
        if (typeof prop !== 'string') return false;
        target[prop] = value as ComponentType<CodeBlockRendererProps>;
        codeBlockStore.getState().register({
          id: `${pluginId}:code:${prop}`,
          pluginId,
          language: prop,
          component: value as ComponentType<CodeBlockRendererProps>,
        });
        return true;
      },
      deleteProperty(target, prop) {
        if (typeof prop !== 'string') return false;
        delete target[prop];
        codeBlockStore.getState().unregister(`${pluginId}:code:${prop}`);
        return true;
      },
    }
  );

  return {
    get remarkPlugins() {
      return remarkPlugins;
    },
    set remarkPlugins(next: unknown[]) {
      remarkPlugins.length = 0;
      Array.prototype.push.apply(remarkPlugins, next);
      syncRemark(remarkPlugins.slice());
    },
    get rehypePlugins() {
      return rehypePlugins;
    },
    set rehypePlugins(next: unknown[]) {
      rehypePlugins.length = 0;
      Array.prototype.push.apply(rehypePlugins, next);
      syncRehype(rehypePlugins.slice());
    },
    remarkReactComponents,
    remarkCodeComponents,
    events: {
      on(event, handler) {
        return previewEventStore.getState().on(pluginId, event, handler);
      },
    },
  };
}
