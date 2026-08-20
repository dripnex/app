/**
 * @dripnex/commands
 *
 * Markdown editing commands for Dripnex.
 * Pure functions - no Electron, React, or UI dependencies.
 */

// Markdown commands
export {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  insertLink,
  insertHeading,
  insertUnorderedList,
  insertOrderedList,
  insertCheckbox,
  insertQuote,
  insertCodeBlock,
  insertHorizontalRule,
  insertGithubAlert,
  undoChange,
  redoChange,
} from './markdown/commands.js';
export type { GithubAlertKind } from './markdown/commands.js';

export { continueMarkup, continueMarkupKeymap } from './markdown/continueMarkup.js';
export {
  joinLines,
  sortLines,
  reverseSortLines,
  sortLinesInsensitive,
  reverseSortLinesInsensitive,
  insertLineBefore,
  upcaseAtCursor,
  downcaseAtCursor,
  findUnder,
  findUnderPrevious,
  skipAndSelectNextOccurrence,
  splitSelectionByLine,
  scrollLineUp,
  scrollLineDown,
  showInCenter,
  editorLineKeymap,
} from './markdown/lineCommands.js';

export {
  parseListLine,
  formatListLine,
  indentList,
  indentListItem,
  dedentListItem,
  listIndentKeymap,
} from './markdown/listIndent.js';
export type { ParsedListLine, ListKind } from './markdown/listIndent.js';

export {
  SLASH_ITEMS,
  FENCE_LANGUAGES,
  matchSlashLine,
  filterSlashItems,
  matchFenceLang,
  filterFenceLanguages,
} from './markdown/slash.js';
export type { SlashItem, SlashSection } from './markdown/slash.js';

export { extractHeadings } from './markdown/headings.js';
export type { Heading } from './markdown/headings.js';

export {
  isBareHttpUrl,
  isInsideMarkdownLink,
  formatPastedUrl,
  wrapSelectionWithUrl,
  sanitizeLinkTitle,
} from './markdown/urlPaste.js';
export type { UrlPasteFormat } from './markdown/urlPaste.js';

export {
  checkedTaskMarks,
  checkedTaskTextOnLine,
  fenceAt,
  markdownLinkAt,
  markdownLinksInLine,
} from './markdown/editorPolish.js';
export type { FenceRange, MarkdownLinkHit, TextSpan } from './markdown/editorPolish.js';
