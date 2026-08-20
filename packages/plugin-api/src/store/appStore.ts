import type { AppStore, AppStoreSnapshot } from '../types';

export type { AppStore, AppStoreSnapshot };

export const EMPTY_STORE_SNAPSHOT: AppStoreSnapshot = {
  editingNote: { id: null, content: '', isDirty: false },
  notes: { items: [], current: null },
  navigation: { kind: 'global', filter: 'all' },
  view: {
    workspaceRootId: null,
    workspaceListAll: false,
    statusFilter: null,
    tagFilter: null,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  },
  settings: {
    theme: 'system',
    accentColor: '',
    activeThemeId: null,
    performanceMode: 'auto',
    frostTransparency: 40,
    zoomLevel: '100',
  },
  theme: { activeThemeId: null, frosted: false },
};

type SnapshotProvider = () => AppStoreSnapshot;

let provider: SnapshotProvider | null = null;
let cached: AppStoreSnapshot = cloneSnapshot(EMPTY_STORE_SNAPSHOT);
const listeners = new Set<() => void>();

function cloneSnapshot(snapshot: AppStoreSnapshot): AppStoreSnapshot {
  return {
    editingNote: { ...snapshot.editingNote },
    notes: {
      items: snapshot.notes.items.map(item => ({ ...item, tags: [...item.tags] })),
      current: snapshot.notes.current ? { ...snapshot.notes.current } : null,
    },
    navigation: { ...snapshot.navigation },
    view: { ...snapshot.view },
    settings: { ...snapshot.settings },
    theme: { ...snapshot.theme },
  };
}

function refreshCache(): void {
  cached = cloneSnapshot(provider ? provider() : EMPTY_STORE_SNAPSHOT);
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Desktop registers a function that reads Query + Zustand. */
export function setHostStoreSnapshot(fn: SnapshotProvider | null): void {
  provider = fn;
  refreshCache();
  emit();
}

/** Call after any source the snapshot reads has changed. */
export function notifyHostStoreChanged(): void {
  refreshCache();
  emit();
}

const hostStore: AppStore = {
  getState() {
    return cloneSnapshot(cached);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function getHostStore(): AppStore {
  return hostStore;
}
