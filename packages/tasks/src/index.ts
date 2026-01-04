/**
 * @readied/tasks
 *
 * Task parsing for Readied.
 * Pure domain logic - no Electron, React, or UI dependencies.
 */

// Types
export type { TaskProgress } from './core/types.js';

// Parsing
export { countMarkdownTasks } from './core/parsing.js';
