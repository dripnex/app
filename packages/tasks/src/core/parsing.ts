/**
 * Task Parsing
 *
 * Delegates to the shared fence-aware scan.
 */

import { scanMarkdown } from '@dripnex/markdown';
import type { TaskProgress } from './types.js';

/**
 * Count markdown task checkboxes in content.
 *
 * Matches GFM-style task lists (`- [ ]`, `- [x]`, `* [ ]`, `* [x]`).
 * Skips fenced code.
 *
 * @example
 * countMarkdownTasks("- [x] done\n- [ ] todo")
 * // Returns: { total: 2, completed: 1 }
 */
export function countMarkdownTasks(content: string): TaskProgress {
  return scanMarkdown(content).tasks;
}
