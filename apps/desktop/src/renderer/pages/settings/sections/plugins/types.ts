/**
 * Shared types for the Plugins settings section.
 */

import type { PluginConfigSchemaField } from '../../../../../preload/index';

export interface DiscoveredPluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  configSchema?: Record<string, PluginConfigSchemaField>;
}

export interface BuiltInPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface MarketplacePlugin {
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  icon: string;
  isBuiltIn: boolean;
  tags: string[];
  downloads: number;
  bundleUrl: string | null;
}
