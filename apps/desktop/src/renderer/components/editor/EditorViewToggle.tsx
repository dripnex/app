import { memo } from 'react';
import { Columns2, Eye } from 'lucide-react';
import type { EditorViewMode } from '../../stores/editorPreferencesStore';

interface EditorViewToggleProps {
  readonly mode: EditorViewMode;
  readonly onModeChange: (mode: EditorViewMode) => void;
}

/**
 * EditorViewToggle - Two toggle buttons for editor view modes
 *
 * Button 1: Editor/Preview toggle
 * - Shows <> (Code) when in editor/split mode, click → preview
 * - Shows Eye when in preview mode, click → editor
 *
 * Button 2: Split toggle
 * - Click toggles split on/off
 */
export const EditorViewToggle = memo(function EditorViewToggle({
  mode,
  onModeChange,
}: EditorViewToggleProps) {
  const isPreview = mode === 'preview';
  const isSplit = mode === 'split';

  const handlePreviewToggle = () => {
    onModeChange(isPreview ? 'editor' : 'preview');
  };

  const handleSplitToggle = () => {
    onModeChange(isSplit ? 'editor' : 'split');
  };

  return (
    <div className="editor-view-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        className={`editor-view-toggle-btn ${isPreview ? 'active filled' : ''}`}
        onClick={handlePreviewToggle}
        title={isPreview ? 'Back to editor' : 'Preview (⌘⇧P)'}
        aria-label={isPreview ? 'Back to editor' : 'Preview'}
        aria-pressed={isPreview}
      >
        <Eye size={16} />
      </button>
      <button
        type="button"
        className={`editor-view-toggle-btn ${isSplit ? 'active' : ''}`}
        onClick={handleSplitToggle}
        title="Split view"
        aria-label="Split view"
        aria-pressed={isSplit}
      >
        <Columns2 size={16} />
      </button>
    </div>
  );
});
