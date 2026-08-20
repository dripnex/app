import { memo } from 'react';
import type { NoteSnapshot, NoteStatus } from '../../../preload/index';
import { kindFromTags, type NoteKind } from '../../lib/knowledge';
import { KindDropdown } from './KindDropdown';
import { NotebookSelector } from './NotebookSelector';
import { StatusDropdown } from './StatusDropdown';
import { TagsInput } from './TagsInput';
import { sc } from './sc';

interface EditorHeaderProps {
  readonly note: NoteSnapshot;
  readonly tags: readonly string[];
  readonly manualTags: readonly string[];
  readonly onMoveToNotebook: (notebookId: string) => void;
  readonly onStatusChange: (status: NoteStatus) => void;
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
  readonly onKindChange?: (kind: NoteKind) => void;
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
  onKindChange,
}: EditorHeaderProps) {
  const kind = kindFromTags(tags, note.status);

  return (
    <div className={sc('editor-header')}>
      <NotebookSelector notebookId={note.notebookId} onMove={onMoveToNotebook} />
      {onKindChange ? <KindDropdown kind={kind} onChange={onKindChange} /> : null}
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
