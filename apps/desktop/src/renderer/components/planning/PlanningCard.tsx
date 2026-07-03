import { memo, useCallback, useState } from 'react';
import { countMarkdownTasks } from '@dripnex/tasks';
import type { NoteSnapshot, BoardStage, NotePriority } from '../../../preload/index';
import { extractExcerpt } from '../../hooks/useNotes';
import { useTagColorsStore } from '../../stores/tagColorsStore';
import { NOTE_MIME, PRIORITY_CONFIG } from './constants';
import { PlanningCardMenu } from './PlanningCardMenu';

type DropSide = 'above' | 'below';

interface PlanningCardProps {
  readonly note: NoteSnapshot;
  readonly onOpen: (id: string) => void;
  readonly onMoveStage: (id: string, stage: BoardStage) => void;
  readonly onSetPriority: (id: string, priority: NotePriority) => void;
  readonly onRemoveFromBoard: (id: string) => void;
  readonly onDelete: (id: string) => void;
  /** Reorder: drop `draggedId` above/below this card. */
  readonly onDropCard: (draggedId: string, targetId: string, side: DropSide) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A draggable card on the Planning board. It is also a drop target so cards can
 * be reordered within a column (drop above/below the hovered card). Dragging
 * carries the note id via a custom MIME type.
 */
export const PlanningCard = memo(function PlanningCard({
  note,
  onOpen,
  onMoveStage,
  onSetPriority,
  onRemoveFromBoard,
  onDelete,
  onDropCard,
}: PlanningCardProps) {
  const getColor = useTagColorsStore(state => state.getColor);
  const [dropSide, setDropSide] = useState<DropSide | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(NOTE_MIME, note.id);
      e.dataTransfer.setData('text/plain', note.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [note.id]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Take over from the column so the drop lands at this precise position.
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropSide(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropSide(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const side = dropSide ?? 'above';
      setDropSide(null);
      const draggedId = e.dataTransfer.getData(NOTE_MIME);
      if (draggedId && draggedId !== note.id) onDropCard(draggedId, note.id, side);
    },
    [dropSide, note.id, onDropCard]
  );

  const tasks = countMarkdownTasks(note.content);
  const excerpt = extractExcerpt(note.content, 120);
  const currentStage: BoardStage = note.boardStage ?? 'backlog';
  // Be resilient to snapshots missing/with unknown priority (e.g. a stale main
  // process during dev HMR, or notes synced before the field existed).
  const priority: NotePriority = note.priority ?? 'none';
  const priorityConfig = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.none;
  const dropClass = dropSide ? `planning-card--drop-${dropSide}` : '';

  return (
    <article
      className={`planning-card ${dropClass}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      // No role="button": the card contains interactive controls (the menu),
      // which is invalid inside a button. Mouse clicks are safe because the menu
      // stops propagation; Enter is gated to the card itself so pressing Enter on
      // the menu button doesn't also open the note.
      onClick={() => onOpen(note.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(note.id);
      }}
      tabIndex={0}
      aria-label={`Open note: ${note.title || 'Untitled'}`}
    >
      <div className="planning-card__top">
        {priority !== 'none' && (
          <span
            className="planning-card__priority"
            style={{ backgroundColor: priorityConfig.color }}
            title={`Priority: ${priorityConfig.label}`}
            aria-label={`Priority: ${priorityConfig.label}`}
          />
        )}
        <h4 className="planning-card__title">{note.title || 'Untitled'}</h4>
        <PlanningCardMenu
          currentStage={currentStage}
          currentPriority={priority}
          onOpen={() => onOpen(note.id)}
          onMoveStage={stage => onMoveStage(note.id, stage)}
          onSetPriority={priority => onSetPriority(note.id, priority)}
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
