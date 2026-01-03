/**
 * Markdown parsing utilities for UI display
 * Visual derivations only - NOT domain logic
 */

/**
 * Counts markdown task checkboxes in content
 * @example countMarkdownTasks("- [x] done\n- [ ] todo") => { total: 2, completed: 1 }
 */
export function countMarkdownTasks(content: string): { total: number; completed: number } {
  // Match: - [ ] or - [x] or * [ ] or * [x] (with optional leading whitespace)
  const all = content.match(/^[ \t]*[-*]\s+\[.\]/gm) ?? [];
  const done = content.match(/^[ \t]*[-*]\s+\[[xX]\]/gm) ?? [];
  return {
    total: all.length,
    completed: done.length,
  };
}
