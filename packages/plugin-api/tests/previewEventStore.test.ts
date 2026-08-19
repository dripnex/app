import { describe, it, expect, beforeEach } from 'vitest';
import { emitPreviewEvent, previewEventStore } from '../src/preview/previewEventStore';

describe('previewEventStore', () => {
  beforeEach(() => {
    previewEventStore.getState().removeAll('a');
    previewEventStore.getState().removeAll('b');
  });

  it('emits to matching listeners and honors preventDefault', () => {
    const seen: string[] = [];
    previewEventStore.getState().on('a', 'a:click', detail => {
      seen.push('a');
      if ('href' in detail) seen.push(detail.href);
    });
    previewEventStore.getState().on('b', 'a:click', () => false);

    expect(emitPreviewEvent('a:click', { href: 'https://dripnex.app', text: 'x' })).toBe(false);
    expect(seen).toEqual(['a', 'https://dripnex.app']);
  });

  it('removeAll drops a plugin’s handlers', () => {
    previewEventStore.getState().on('a', 'checkbox:change', () => false);
    previewEventStore.getState().removeAll('a');
    expect(emitPreviewEvent('checkbox:change', { index: 0, checked: true })).toBe(true);
  });
});
