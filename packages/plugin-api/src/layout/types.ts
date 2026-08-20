import type { ComponentType } from 'react';

export type LayoutZoneName =
  | 'sidebar-section'
  | 'sidebar-footer'
  | 'editor-toolbar'
  | 'editor-status-bar'
  | 'editor-header-actions'
  | 'editor-footer'
  | 'preview-toolbar'
  | 'panel'
  | 'modal'
  | 'settings-section'
  | 'note-list-header'
  | 'note-list-footer'
  | 'note-list-item-suffix'
  | 'command-palette-footer';

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
