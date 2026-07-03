import { memo, useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import type { NoteSnapshot, BoardStage, NotePriority } from '../../../preload/index';
import { PlanningCard } from './PlanningCard';
import { NOTE_MIME, BOARD_STAGE_LABELS } from './constants';

type DropSide = 'above' | 'below' | 'append';

interface PlanningColumnProps {
  readonly stage: BoardStage;
  readonly notes: readonly NoteSnapshot[];
  /** Move `draggedId` into this column relative to `targetId` (null = append). */
  readonly onReorder: (
    draggedId: string,
    stage: BoardStage,
    targetId: string | null,
    side: DropSide
  ) => void;
  readonly onAddCard: (stage: BoardStage) => void;
  readonly onOpenNote: (id: string) => void;
  readonly onMoveStage: (id: string, stage: BoardStage) => void;
  readonly onSetPriority: (id: string, priority: NotePriority) => void;
  readonly onRemoveFromBoard: (id: string) => void;
  readonly onDeleteNote: (id: string) => void;
}

/** A droppable Kanban column for a single board stage. */
export const PlanningColumn = memo(function PlanningColumn({
  stage,
  notes,
  onReorder,
  onAddCard,
  onOpenNote,
  onMoveStage,
  onSetPriority,
  onRemoveFromBoard,
  onDeleteNote,
}: PlanningColumnProps) {
  const [isOver, setIsOver] = useState(false);

  // preventDefault unconditionally so the drop always fires (some Chromium
  // builds don't enumerate custom types in `types` during dragover).
  const allowDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false);
  }, []);

  // Drops that reach the column background (not a card) append to the end.
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);
      const noteId = e.dataTransfer.getData(NOTE_MIME);
      if (noteId) onReorder(noteId, stage, null, 'append');
    },
    [onReorder, stage]
  );

  const handleDropCard = useCallback(
    (draggedId: string, targetId: string, side: 'above' | 'below') => {
      onReorder(draggedId, stage, targetId, side);
    },
    [onReorder, stage]
  );

  return (
    <section
      className={`planning-column ${isOver ? 'planning-column--over' : ''}`}
      onDragEnter={allowDrop}
      onDragOver={allowDrop}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label={BOARD_STAGE_LABELS[stage]}
    >
      <header className="planning-column__header">
        <span className="planning-column__title">{BOARD_STAGE_LABELS[stage]}</span>
        <span className="planning-column__count">{notes.length}</span>
        <button
          type="button"
          className="planning-column__add"
          onClick={() => onAddCard(stage)}
          aria-label={`Add card to ${BOARD_STAGE_LABELS[stage]}`}
          title="Add card"
        >
          <Plus size={14} />
        </button>
      </header>
      <div className="planning-column__cards">
        {notes.length === 0 ? (
          <button type="button" className="planning-column__empty" onClick={() => onAddCard(stage)}>
            <Plus size={14} /> Add a card
          </button>
        ) : (
          notes.map(note => (
            <PlanningCard
              key={note.id}
              note={note}
              onOpen={onOpenNote}
              onMoveStage={onMoveStage}
              onSetPriority={onSetPriority}
              onRemoveFromBoard={onRemoveFromBoard}
              onDelete={onDeleteNote}
              onDropCard={handleDropCard}
            />
          ))
        )}
      </div>
    </section>
  );
});
