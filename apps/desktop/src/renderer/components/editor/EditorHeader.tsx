import { memo } from 'react';
import type { NoteSnapshot, NoteStatus } from '../../../preload/index';
import { NotebookSelector } from './NotebookSelector';
import { StatusDropdown } from './StatusDropdown';
import { TagsInput } from './TagsInput';

interface EditorHeaderProps {
  readonly note: NoteSnapshot;
  readonly onMoveToNotebook: (notebookId: string) => void;
  readonly onStatusChange: (status: NoteStatus) => void;
}

/**
 * EditorHeader - Metadata controls above the note title
 *
 * Contains: NotebookSelector | StatusDropdown | TagsInput
 * Pure UI component - all mutations happen via callbacks
 */
export const EditorHeader = memo(function EditorHeader({
  note,
  onMoveToNotebook,
  onStatusChange,
}: EditorHeaderProps) {
  return (
    <div className="editor-header">
      <NotebookSelector
        notebookId={note.notebookId}
        onMove={onMoveToNotebook}
      />
      <StatusDropdown
        status={note.status}
        onStatusChange={onStatusChange}
      />
      <TagsInput tags={note.tags} />
    </div>
  );
});
