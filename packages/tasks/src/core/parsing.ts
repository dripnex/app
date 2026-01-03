/**
 * Task Parsing
 *
 * Pure domain logic for extracting task information from markdown content.
 * No dependencies on storage, UI, or external libraries.
 */

import type { TaskProgress } from './types.js';

/**
 * Count markdown task checkboxes in content.
 *
 * Matches GFM-style task lists:
 * - `- [ ]` or `- [x]` (dash)
 * - `* [ ]` or `* [x]` (asterisk)
 *
 * @param content - Markdown content to parse
 * @returns Object with total and completed task counts
 *
 * @example
 * countMarkdownTasks("- [x] done\n- [ ] todo")
 * // Returns: { total: 2, completed: 1 }
 */
export function countMarkdownTasks(content: string): TaskProgress {
  // Match: - [ ] or - [x] or * [ ] or * [x] (with optional leading whitespace)
  const all = content.match(/^[ \t]*[-*]\s+\[.\]/gm) ?? [];
  const done = content.match(/^[ \t]*[-*]\s+\[[xX]\]/gm) ?? [];

  return {
    total: all.length,
    completed: done.length,
  };
}
