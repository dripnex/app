/**
 * Task Types
 *
 * Core types for the task parsing system.
 */

/** Progress of markdown tasks in content */
export interface TaskProgress {
  /** Total number of tasks */
  total: number;
  /** Number of completed tasks */
  completed: number;
}
