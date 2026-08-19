import type { CommandContext } from '@dripnex/command-registry';

type ContextTarget = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

export type LiveCommandContext = Extract<CommandContext, 'editor' | 'note-list' | 'app'>;

export function resolveCommandContext(
  target: unknown,
  root?: { querySelector: (selector: string) => unknown } | null
): LiveCommandContext {
  if (matchesClosest(target, '.cm-editor') || matchesClosest(target, '.cm-search')) {
    return 'editor';
  }
  if (isFormInput(target)) return 'app';
  if (
    matchesClosest(target, '[data-preview]') ||
    matchesClosest(target, '[role="dialog"]') ||
    matchesClosest(target, '.command-palette-overlay')
  ) {
    return 'app';
  }

  const doc = root ?? (typeof document !== 'undefined' ? document : null);
  if (doc?.querySelector('[data-note-list]')) return 'note-list';
  return 'app';
}

function isFormInput(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as ContextTarget;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}

function matchesClosest(target: unknown, selector: string): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as ContextTarget;
  return typeof el.closest === 'function' && Boolean(el.closest(selector));
}
