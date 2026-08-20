type ConfigListener = (value: unknown) => void;

const caches = new Map<string, Record<string, unknown>>();
const observers = new Map<string, Map<string, Set<ConfigListener>>>();

export function resetPluginConfig(pluginId: string, initial: Record<string, unknown> = {}): void {
  caches.set(pluginId, { ...initial });
  observers.delete(pluginId);
}

export function clearPluginConfig(pluginId: string): void {
  caches.delete(pluginId);
  observers.delete(pluginId);
}

export function getPluginConfig<T>(pluginId: string, key: string): T | undefined {
  return caches.get(pluginId)?.[key] as T | undefined;
}

/** Update cache and notify observers. Returns false when the value is unchanged. */
export function applyPluginConfig(pluginId: string, key: string, value: unknown): boolean {
  const cache = caches.get(pluginId) ?? {};
  if (Object.is(cache[key], value)) {
    caches.set(pluginId, cache);
    return false;
  }
  cache[key] = value;
  caches.set(pluginId, cache);
  const keyObservers = observers.get(pluginId)?.get(key);
  if (keyObservers) {
    for (const listener of keyObservers) listener(value);
  }
  return true;
}

export function observePluginConfig(
  pluginId: string,
  key: string,
  callback: ConfigListener
): () => void {
  let byKey = observers.get(pluginId);
  if (!byKey) {
    byKey = new Map();
    observers.set(pluginId, byKey);
  }
  let set = byKey.get(key);
  if (!set) {
    set = new Set();
    byKey.set(key, set);
  }
  set.add(callback);
  return () => {
    set.delete(callback);
    if (set.size === 0) byKey.delete(key);
  };
}
