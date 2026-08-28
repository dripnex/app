import type { PluginManifest } from '@dripnex/plugin-api';
import { walkSourceLines } from './sourceScan';

/** Same GFM list mark as `scanMarkdown` / task toggle: `-` or `*`. */
const OPEN_TASK = /^([ \t]*[-*]\s+)\[ \]/;
const DONE_TASK = /^([ \t]*[-*]\s+)\[[xX]\]/;

function taskHits(content: string, mark: RegExp): Array<{ from: number; to: number }> {
  const hits: Array<{ from: number; to: number }> = [];
  for (const row of walkSourceLines(content)) {
    if (row.inFence) continue;
    const match = row.line.match(mark);
    if (!match) continue;
    const from = row.from + (match[1]?.length ?? 0);
    hits.push({ from, to: from + 3 });
  }
  return hits;
}

function incompleteTaskHits(content: string): Array<{ from: number; to: number }> {
  return taskHits(content, OPEN_TASK);
}

function completedTaskHits(content: string): Array<{ from: number; to: number }> {
  return taskHits(content, DONE_TASK);
}

/** Next open GFM task at or after offset, wrapping. Fences and `[x]` skipped. Does not rewrite. */
export function nextIncompleteTaskRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = incompleteTaskHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous open GFM task at or before offset, wrapping. Fences and `[x]` skipped. Does not rewrite. */
export function previousIncompleteTaskRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = incompleteTaskHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

/** Next checked GFM task at or after offset, wrapping. Fences and `[ ]` skipped. Does not rewrite. */
export function nextCompletedTaskRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = completedTaskHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const after = here ? here.to : offset;
  return hits.find(h => h.from >= after) ?? hits[0] ?? null;
}

/** Previous checked GFM task at or before offset, wrapping. Fences and `[ ]` skipped. Does not rewrite. */
export function previousCompletedTaskRange(
  content: string,
  offset: number
): { from: number; to: number } | null {
  const hits = completedTaskHits(content);
  if (hits.length === 0) return null;
  const here = hits.find(h => offset >= h.from && offset <= h.to);
  const before = here ? here.from : offset;
  return [...hits].reverse().find(h => h.to <= before) ?? hits[hits.length - 1] ?? null;
}

export const jumpTaskPlugin: PluginManifest = {
  id: 'dripnex-jump-task',
  name: 'Jump Task',
  version: '1.0.0',
  description: 'Jump to the next or previous incomplete or completed GFM task in the current note',

  activate(context) {
    const jump = (pick: typeof nextIncompleteTaskRange, miss: string) => {
      const content = context.editor.getContent();
      const from = context.editor.getSelection().from;
      const target = pick(content, from);
      if (!target) {
        context.notifications.addInfo(miss);
        return false;
      }
      context.editor.setSelection(target.from, target.to);
      context.editor.focus();
      return true;
    };

    const unregisterNext = context.registerCommand(
      { id: 'next', name: 'Jump to Next Incomplete Task', icon: 'CheckSquare' },
      () => jump(nextIncompleteTaskRange, 'No incomplete tasks')
    );
    const unregisterPrevious = context.registerCommand(
      { id: 'previous', name: 'Jump to Previous Incomplete Task', icon: 'CheckSquare' },
      () => jump(previousIncompleteTaskRange, 'No incomplete tasks')
    );
    const unregisterNextDone = context.registerCommand(
      { id: 'next-done', name: 'Jump to Next Completed Task', icon: 'CheckSquare' },
      () => jump(nextCompletedTaskRange, 'No completed tasks')
    );
    const unregisterPreviousDone = context.registerCommand(
      { id: 'previous-done', name: 'Jump to Previous Completed Task', icon: 'CheckSquare' },
      () => jump(previousCompletedTaskRange, 'No completed tasks')
    );

    return {
      dispose() {
        unregisterNext();
        unregisterPrevious();
        unregisterNextDone();
        unregisterPreviousDone();
      },
    };
  },
};
