import { memo } from 'react';
import { Columns2, Eye, PenLine } from 'lucide';
import { Icon } from '../../ui/icons/Icon';
import type { EditorViewMode } from '../../stores/editorPreferencesStore';
import { sc } from '../noteEditorSc';

interface EditorViewToggleProps {
  readonly mode: EditorViewMode;
  readonly onModeChange: (mode: EditorViewMode) => void;
}

const MODES: Array<{ id: EditorViewMode; label: string; icon: typeof PenLine }> = [
  { id: 'editor', label: 'Edit', icon: PenLine },
  { id: 'split', label: 'Split', icon: Columns2 },
  { id: 'preview', label: 'Preview', icon: Eye },
];

export const EditorViewToggle = memo(function EditorViewToggle({
  mode,
  onModeChange,
}: EditorViewToggleProps) {
  return (
    <div className={sc('editor-view-toggle')} role="group" aria-label="View mode">
      {MODES.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          className={sc('editor-view-toggle-btn', mode === id && 'active')}
          onClick={() => onModeChange(id)}
          title={label}
          aria-label={label}
          aria-pressed={mode === id}
        >
          <Icon icon={icon} size={16} />
        </button>
      ))}
    </div>
  );
});
