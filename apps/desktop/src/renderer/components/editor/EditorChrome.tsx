import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, SquareArrowOutUpRight } from 'lucide-react';
import type { EditorViewMode } from '../../stores/editorPreferencesStore';
import { IconButton } from '../../ui/primitives';
import { sc } from '../noteEditorSc';
import { EditorViewToggle } from './EditorViewToggle';

interface EditorChromeProps {
  variant?: 'main' | 'window';
  canBack: boolean;
  canForward: boolean;
  distractionFree: boolean;
  viewMode: EditorViewMode;
  onBack: () => void;
  onForward: () => void;
  onToggleZen: () => void;
  onOpenWindow: () => void;
  onModeChange: (mode: EditorViewMode) => void;
  outlineButton: ReactNode;
  actions: ReactNode;
}

export function EditorChrome({
  variant = 'main',
  canBack,
  canForward,
  distractionFree,
  viewMode,
  onBack,
  onForward,
  onToggleZen,
  onOpenWindow,
  onModeChange,
  outlineButton,
  actions,
}: EditorChromeProps) {
  return (
    <div className={sc('note-editor-chrome')} data-variant={variant}>
      <div className={sc('note-editor-chrome-left')}>
        {variant === 'main' ? (
          <>
            <IconButton label="Open in new window" onClick={onOpenWindow}>
              <SquareArrowOutUpRight size={16} aria-hidden="true" />
            </IconButton>
            <IconButton
              label={distractionFree ? 'Exit Distraction Free Mode' : 'Enter Distraction Free Mode'}
              pressed={distractionFree}
              onClick={onToggleZen}
            >
              {distractionFree ? (
                <Minimize2 size={16} aria-hidden="true" />
              ) : (
                <Maximize2 size={16} aria-hidden="true" />
              )}
            </IconButton>
            <IconButton label="Back" disabled={!canBack} onClick={onBack}>
              <ArrowLeft size={16} aria-hidden="true" />
            </IconButton>
            <IconButton label="Forward" disabled={!canForward} onClick={onForward}>
              <ArrowRight size={16} aria-hidden="true" />
            </IconButton>
          </>
        ) : (
          <span className={sc('note-editor-chrome-drag')} aria-hidden="true" />
        )}
      </div>
      <div className={sc('note-editor-header-mid')}>
        <EditorViewToggle mode={viewMode} onModeChange={onModeChange} />
        {outlineButton}
      </div>
      <div className={sc('note-editor-header-actions')}>{actions}</div>
    </div>
  );
}
