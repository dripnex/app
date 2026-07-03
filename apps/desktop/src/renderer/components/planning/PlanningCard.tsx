import { memo, useCallback } from 'react';
import { countMarkdownTasks } from '@dripnex/tasks';
import type { NoteSnapshot } from '../../../preload/index';
import { extractExcerpt } from '../../hooks/useNotes';
import { NOTE_MIME } from './constants';

interface PlanningCardProps {
  readonly note: NoteSnapshot;
  readonly onOpen: (id: string) => void;
}

/**
 * A draggable card on the Planning board. Dragging carries the note id via a
 * custom MIME type; dropping on a column updates the note's boardStage.
 */
export const PlanningCard = memo(function PlanningCard({ note, onOpen }: PlanningCardProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(NOTE_MIME, note.id);
      e.dataTransfer.setData('text/plain', note.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [note.id]
  );

  const tasks = countMarkdownTasks(note.content);
  const excerpt = extractExcerpt(note.content, 120);

  return (
    <article
      className="planning-card"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onOpen(note.id)}
      onKeyDown={e => {
        if (e.key === 'Enter') onOpen(note.id);
      }}
      role="button"
      tabIndex={0}
    >
      <h4 className="planning-card__title">{note.title || 'Untitled'}</h4>
      {excerpt && <p className="planning-card__excerpt">{excerpt}</p>}
      {(note.tags.length > 0 || tasks.total > 0) && (
        <div className="planning-card__footer">
          {note.tags.length > 0 && (
            <div className="planning-card__tags">
              {note.tags.slice(0, 3).map(tag => (
                <span key={tag} className="planning-card__tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {tasks.total > 0 && (
            <span className="planning-card__tasks" title="Task progress">
              {tasks.completed}/{tasks.total}
            </span>
          )}
        </div>
      )}
    </article>
  );
});
