import { memo } from 'react';
import type { NoteSnapshot, NoteStatus } from '../../../preload/index';
import { NotebookSelector } from './NotebookSelector';
import { StatusDropdown } from './StatusDropdown';
import { TagsInput } from './TagsInput';

interface EditorHeaderProps {
  readonly note: NoteSnapshot;
  readonly tags: readonly string[];
  readonly manualTags: readonly string[];
  readonly onMoveToNotebook: (notebookId: string) => void;
  readonly onStatusChange: (status: NoteStatus) => void;
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
}

/**
 * EditorHeader - Metadata controls above the note title
 *
 * Contains: NotebookSelector | StatusDropdown | TagsInput
 * Pure UI component - all mutations happen via callbacks
 */
export const EditorHeader = memo(function EditorHeader({
  note,
  tags,
  manualTags,
  onMoveToNotebook,
  onStatusChange,
  onAddTag,
  onRemoveTag,
}: EditorHeaderProps) {
  return (
    <div className="editor-header">
      <NotebookSelector notebookId={note.notebookId} onMove={onMoveToNotebook} />
      <StatusDropdown status={note.status} onStatusChange={onStatusChange} />
      <TagsInput
        tags={tags}
        manualTags={manualTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
      />
    </div>
  );
});
