/**
 * Built-in Plugins Registry
 *
 * Single source of truth for all built-in plugin manifests.
 * Used by App.tsx (plugin loading) and PluginsSection (settings display).
 */

import type { PluginManifest } from '@readied/plugin-api';
import { wordCountPlugin } from './wordCount';
import { typewriterModePlugin } from './typewriterMode';
import { activeLineHighlightPlugin } from './activeLineHighlight';
import { aiAssistantPlugin } from './aiAssistant';
import { tablesPlugin } from './tables';

export {
  wordCountPlugin,
  typewriterModePlugin,
  activeLineHighlightPlugin,
  aiAssistantPlugin,
  tablesPlugin,
};

/** All built-in plugin manifests. */
export const builtInPlugins: PluginManifest[] = [
  wordCountPlugin,
  typewriterModePlugin,
  activeLineHighlightPlugin,
  aiAssistantPlugin,
  tablesPlugin,
];
