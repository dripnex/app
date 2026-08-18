import { memo } from 'react';
import { Columns2, Eye, PenLine } from 'lucide-react';
import type { EditorViewMode } from '../../stores/editorPreferencesStore';
import { sc } from '../noteEditorSc';

interface EditorViewToggleProps {
  readonly mode: EditorViewMode;
  readonly onModeChange: (mode: EditorViewMode) => void;
}

const MODES: Array<{ id: EditorViewMode; label: string; Icon: typeof PenLine }> = [
  { id: 'editor', label: 'Edit', Icon: PenLine },
  { id: 'split', label: 'Split', Icon: Columns2 },
  { id: 'preview', label: 'Preview', Icon: Eye },
];

export const EditorViewToggle = memo(function EditorViewToggle({
  mode,
  onModeChange,
}: EditorViewToggleProps) {
  return (
    <div className={sc('editor-view-toggle')} role="group" aria-label="View mode">
      {MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={sc('editor-view-toggle-btn', mode === id && 'active')}
          onClick={() => onModeChange(id)}
          title={label}
          aria-label={label}
          aria-pressed={mode === id}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
});
