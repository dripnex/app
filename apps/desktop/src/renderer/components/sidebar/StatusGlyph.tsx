import { Check, Pause, Play, X } from 'lucide';
import { Icon, type IconInput } from '../../ui/icons/Icon';
import type { NoteStatus } from '../../../preload/index';

const ICONS: Record<NoteStatus, IconInput> = {
  active: Play,
  on_hold: Pause,
  completed: Check,
  dropped: X,
};

/** Stroke icon — color comes from the parent (sidebar / header tokens). */
export function StatusGlyph({ status }: { status: NoteStatus }) {
  return <Icon icon={ICONS[status]} size={14} strokeWidth={2.25} />;
}
