import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { layoutStore } from './layoutStore';
import type { LayoutZoneName, ZoneEntry } from './types';
import { PluginErrorBoundary } from './PluginErrorBoundary';

interface LayoutZoneProps {
  name: LayoutZoneName;
  className?: string;
  wrapper?: ComponentType<{ entry: ZoneEntry; children: ReactNode }>;
  /** Host-provided props merged into each plugin component's `meta`. */
  meta?: Record<string, unknown>;
}

function getSnapshot(name: LayoutZoneName): () => ZoneEntry[] {
  let prev: ZoneEntry[] = [];
  return () => {
    const state = layoutStore.getState();
    const entries = state.zones.get(name) ?? [];
    // Referential equality check to avoid unnecessary re-renders
    if (entries.length === prev.length && entries.every((e, i) => e === prev[i])) {
      return prev;
    }
    prev = entries;
    return entries;
  };
}

const snapshots = new Map<LayoutZoneName, () => ZoneEntry[]>();

function getOrCreateSnapshot(name: LayoutZoneName): () => ZoneEntry[] {
  let snap = snapshots.get(name);
  if (!snap) {
    snap = getSnapshot(name);
    snapshots.set(name, snap);
  }
  return snap;
}

/**
 * LayoutZone renders all registered components for a given zone.
 *
 * Usage:
 * ```tsx
 * <LayoutZone name="editor-status-bar" className="status-bar" />
 * <LayoutZone name="sidebar-section" wrapper={SidebarSectionWrapper} />
 * ```
 */
export function LayoutZone({ name, className, wrapper: Wrapper, meta: hostMeta }: LayoutZoneProps) {
  const subscribe = layoutStore.subscribe;
  const snapshot = getOrCreateSnapshot(name);
  const entries = useSyncExternalStore(subscribe, snapshot, snapshot);

  if (entries.length === 0) return null;

  return (
    <div className={className} data-layout-zone={name}>
      {entries.map(entry => {
        const { component: Component, meta, id, pluginId } = entry;
        const merged = hostMeta ? { ...meta, ...hostMeta } : meta;
        const rendered = (
          <PluginErrorBoundary key={id} pluginId={pluginId}>
            <Component meta={merged} />
          </PluginErrorBoundary>
        );

        if (Wrapper) {
          return (
            <Wrapper key={id} entry={entry}>
              {rendered}
            </Wrapper>
          );
        }

        return rendered;
      })}
    </div>
  );
}
