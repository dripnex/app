import { useSyncExternalStore } from 'react';
import { EditorView } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import { vimModeLabel } from './modeLabel';

let mode = 'NORMAL';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getVimStatusMode(): string {
  return mode;
}

export function subscribeVimStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setVimStatusMode(next: string): void {
  if (next === mode) return;
  mode = next;
  emit();
}

export function vimStatusListener() {
  return EditorView.updateListener.of(update => {
    const cm = getCM(update.view);
    setVimStatusMode(vimModeLabel(cm?.state.vim));
  });
}

export function VimStatusIndicator() {
  const label = useSyncExternalStore(subscribeVimStatus, getVimStatusMode, getVimStatusMode);
  return (
    <span
      style={{
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '0.05em',
        color: label === 'INSERT' || label === 'REPLACE' ? 'var(--accent)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </span>
  );
}
