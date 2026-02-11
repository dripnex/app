import type { ComponentType } from 'react';

export type LayoutZoneName =
  | 'sidebar-section'
  | 'editor-toolbar'
  | 'editor-status-bar'
  | 'editor-header-actions'
  | 'panel'
  | 'modal';

export interface ZoneComponentProps {
  meta?: Record<string, unknown>;
}

export interface ZoneEntry {
  id: string;
  pluginId: string;
  component: ComponentType<ZoneComponentProps>;
  order: number;
  meta?: Record<string, unknown>;
}

export interface LayoutManager {
  addComponent(zone: LayoutZoneName, entry: Omit<ZoneEntry, 'pluginId'>): void;
  removeComponent(id: string): void;
  removeAllForPlugin(pluginId: string): void;
}
