import { Check, Pause, Play, X } from 'lucide-react';
import type { NoteStatus } from '../../../preload/index';

const ICONS: Record<NoteStatus, typeof Play> = {
  active: Play,
  on_hold: Pause,
  completed: Check,
  dropped: X,
};

/** Stroke icon — color comes from the parent (sidebar / header tokens). */
export function StatusGlyph({ status }: { status: NoteStatus }) {
  const Icon = ICONS[status];
  return <Icon size={14} strokeWidth={2.25} aria-hidden="true" />;
}
