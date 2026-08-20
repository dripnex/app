/// <reference lib="dom" />
/**
 * Injects styles/*.css from active plugin packages into document.head.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { pluginStyleStore } from './pluginStyleStore';

const ATTR = 'data-dripnex-plugin-styles';

const subscribe = (cb: () => void) => pluginStyleStore.subscribe(cb);
const getSnapshot = () => pluginStyleStore.getState().sheets;

export function usePluginStyles(): void {
  const sheets = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const nodes: HTMLStyleElement[] = [];
    for (const sheet of sheets) {
      const el = document.createElement('style');
      el.setAttribute(ATTR, sheet.pluginId);
      el.textContent = sheet.sources.join('\n');
      document.head.appendChild(el);
      nodes.push(el);
    }
    return () => {
      for (const el of nodes) el.remove();
    };
  }, [sheets]);
}
