import { memo, useCallback } from 'react';
import { countMarkdownTasks } from '@dripnex/tasks';
import type { NoteSnapshot, BoardStage } from '../../../preload/index';
import { extractExcerpt } from '../../hooks/useNotes';
import { useTagColorsStore } from '../../stores/tagColorsStore';
import { NOTE_MIME } from './constants';
import { PlanningCardMenu } from './PlanningCardMenu';

interface PlanningCardProps {
  readonly note: NoteSnapshot;
  readonly onOpen: (id: string) => void;
  readonly onMoveStage: (id: string, stage: BoardStage) => void;
  readonly onRemoveFromBoard: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A draggable card on the Planning board. Dragging carries the note id via a
 * custom MIME type; dropping on a column updates the note's boardStage.
 */
export const PlanningCard = memo(function PlanningCard({
  note,
  onOpen,
  onMoveStage,
  onRemoveFromBoard,
  onDelete,
}: PlanningCardProps) {
  const getColor = useTagColorsStore(state => state.getColor);

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
  const currentStage: BoardStage = note.boardStage ?? 'backlog';

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
      <div className="planning-card__top">
        <h4 className="planning-card__title">{note.title || 'Untitled'}</h4>
        <PlanningCardMenu
          currentStage={currentStage}
          onOpen={() => onOpen(note.id)}
          onMoveStage={stage => onMoveStage(note.id, stage)}
          onRemoveFromBoard={() => onRemoveFromBoard(note.id)}
          onDelete={() => onDelete(note.id)}
        />
      </div>

      {excerpt && <p className="planning-card__excerpt">{excerpt}</p>}

      {note.tags.length > 0 && (
        <div className="planning-card__tags">
          {note.tags.slice(0, 4).map(tag => {
            const color = getColor(tag);
            return (
              <span key={tag} className="planning-card__tag">
                <span
                  className="planning-card__tag-dot"
                  style={{ backgroundColor: color ?? 'var(--text-faint)' }}
                  aria-hidden="true"
                />
                {tag}
              </span>
            );
          })}
        </div>
      )}

      <div className="planning-card__footer">
        <span className="planning-card__date">{formatDate(note.createdAt)}</span>
        {tasks.total > 0 && (
          <span className="planning-card__tasks" title="Task progress">
            {tasks.completed}/{tasks.total}
          </span>
        )}
      </div>
    </article>
  );
});
