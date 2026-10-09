/**
 * Built-in Plugins Registry
 *
 * Single source of truth for all built-in plugin manifests.
 * Used by App.tsx (plugin loading) and PluginsSection (settings display).
 */

import type { PluginManifest } from '@dripnex/plugin-api';
import { wordCountPlugin } from './wordCount';
import { typewriterModePlugin } from './typewriterMode';
import { activeLineHighlightPlugin } from './activeLineHighlight';
import { aiAssistantPlugin } from './aiAssistant';
import { tablesPlugin } from './tables';
import { focusModePlugin } from './focusMode';
import { readingTimePlugin } from './readingTime';
import { exportMarkdownPlugin } from './exportMarkdown';
import { mermaidPlugin } from './mermaid';
import { mathPlugin } from './math';
import { pasteAsLinkPlugin } from './pasteAsLink';
import { motionPlugin } from './motion';
import { footnotesPlugin } from './footnotes';
import { taskTogglePlugin } from './taskToggle';
import { jumpTaskPlugin } from './jumpTask';
import { cycleHeadingPlugin } from './cycleHeading';
import { cycleListPlugin } from './cycleList';
import { cycleQuotePlugin } from './cycleQuote';
import { cycleAlertPlugin } from './cycleAlert';
import { jumpHeadingPlugin } from './jumpHeading';
import { csvPreviewPlugin } from './csvPreview';
import { dailyNotePlugin } from './dailyNote';
import { randomNotePlugin } from './randomNote';
import { unlinkedNotePlugin } from './unlinkedNote';
import { orphanNotePlugin } from './orphanNote';
import { hubNotePlugin } from './hubNote';
import { spokeNotePlugin } from './spokeNote';
import { untaggedNotePlugin } from './untaggedNote';
import { mostTaggedNotePlugin } from './mostTaggedNote';
import { stubNotePlugin } from './stubNote';
import { longestNotePlugin } from './longestNote';
import { staleNotePlugin } from './staleNote';
import { newestNotePlugin } from './newestNote';
import { danglingWikilinkPlugin } from './danglingWikilink';
import { wrapWikilinkPlugin } from './wrapWikilink';
import { wrapEmbedPlugin } from './wrapEmbed';
import { jumpEmbedPlugin } from './jumpEmbed';
import { wrapImagePlugin } from './wrapImage';
import { wrapLinkPlugin } from './wrapLink';
import { wrapCodePlugin } from './wrapCode';
import { wrapStrikePlugin } from './wrapStrike';
import { jumpStrikePlugin } from './jumpStrike';
import { jumpWikilinkPlugin } from './jumpWikilink';
import { jumpLinkPlugin } from './jumpLink';
import { jumpImagePlugin } from './jumpImage';
import { jumpFencePlugin } from './jumpFence';
import { jumpTablePlugin } from './jumpTable';
import { jumpAlertPlugin } from './jumpAlert';
import { jumpQuotePlugin } from './jumpQuote';
import { jumpListPlugin } from './jumpList';
import { jumpHrPlugin } from './jumpHr';
import { jumpTagPlugin } from './jumpTag';
import { wrapTagPlugin } from './wrapTag';
import { wrapMathPlugin } from './wrapMath';
import { jumpMathPlugin } from './jumpMath';
import { duplicateTitlePlugin } from './duplicateTitle';
import { journalPlugin } from './journal';
import { copyNotePlugin } from './copyNote';
import { noteStatsPlugin } from './noteStats';
import { backlinksPlugin, relatedNotesPlugin } from './backlinks';
import { paletteLibraryPlugin } from './paletteLibrary';

export {
  wordCountPlugin,
  typewriterModePlugin,
  activeLineHighlightPlugin,
  aiAssistantPlugin,
  tablesPlugin,
  focusModePlugin,
  readingTimePlugin,
  exportMarkdownPlugin,
  mermaidPlugin,
  mathPlugin,
  pasteAsLinkPlugin,
  motionPlugin,
  footnotesPlugin,
  taskTogglePlugin,
  jumpTaskPlugin,
  cycleHeadingPlugin,
  cycleListPlugin,
  cycleQuotePlugin,
  cycleAlertPlugin,
  jumpHeadingPlugin,
  csvPreviewPlugin,
  dailyNotePlugin,
  randomNotePlugin,
  unlinkedNotePlugin,
  orphanNotePlugin,
  hubNotePlugin,
  spokeNotePlugin,
  untaggedNotePlugin,
  mostTaggedNotePlugin,
  stubNotePlugin,
  longestNotePlugin,
  staleNotePlugin,
  newestNotePlugin,
  danglingWikilinkPlugin,
  wrapWikilinkPlugin,
  wrapEmbedPlugin,
  jumpEmbedPlugin,
  wrapImagePlugin,
  wrapLinkPlugin,
  wrapCodePlugin,
  wrapStrikePlugin,
  jumpStrikePlugin,
  jumpWikilinkPlugin,
  jumpLinkPlugin,
  jumpImagePlugin,
  jumpFencePlugin,
  jumpTablePlugin,
  jumpAlertPlugin,
  jumpQuotePlugin,
  jumpListPlugin,
  jumpHrPlugin,
  jumpTagPlugin,
  wrapTagPlugin,
  wrapMathPlugin,
  jumpMathPlugin,
  duplicateTitlePlugin,
  journalPlugin,
  copyNotePlugin,
  noteStatsPlugin,
  backlinksPlugin,
  relatedNotesPlugin,
  paletteLibraryPlugin,
};

/** All built-in plugin manifests. */
export const builtInPlugins: PluginManifest[] = [
  wordCountPlugin,
  typewriterModePlugin,
  activeLineHighlightPlugin,
  aiAssistantPlugin,
  tablesPlugin,
  focusModePlugin,
  readingTimePlugin,
  exportMarkdownPlugin,
  mermaidPlugin,
  mathPlugin,
  pasteAsLinkPlugin,
  motionPlugin,
  footnotesPlugin,
  taskTogglePlugin,
  jumpTaskPlugin,
  cycleHeadingPlugin,
  cycleListPlugin,
  cycleQuotePlugin,
  cycleAlertPlugin,
  jumpHeadingPlugin,
  csvPreviewPlugin,
  dailyNotePlugin,
  randomNotePlugin,
  unlinkedNotePlugin,
  orphanNotePlugin,
  hubNotePlugin,
  spokeNotePlugin,
  untaggedNotePlugin,
  mostTaggedNotePlugin,
  stubNotePlugin,
  longestNotePlugin,
  staleNotePlugin,
  newestNotePlugin,
  danglingWikilinkPlugin,
  wrapWikilinkPlugin,
  wrapEmbedPlugin,
  jumpEmbedPlugin,
  wrapImagePlugin,
  wrapLinkPlugin,
  wrapCodePlugin,
  wrapStrikePlugin,
  jumpStrikePlugin,
  jumpWikilinkPlugin,
  jumpLinkPlugin,
  jumpImagePlugin,
  jumpFencePlugin,
  jumpTablePlugin,
  jumpAlertPlugin,
  jumpQuotePlugin,
  jumpListPlugin,
  jumpHrPlugin,
  jumpTagPlugin,
  wrapTagPlugin,
  wrapMathPlugin,
  jumpMathPlugin,
  duplicateTitlePlugin,
  journalPlugin,
  copyNotePlugin,
  noteStatsPlugin,
  backlinksPlugin,
  relatedNotesPlugin,
  paletteLibraryPlugin,
];
