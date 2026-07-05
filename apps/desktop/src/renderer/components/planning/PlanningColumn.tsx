import { memo, useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import type { NoteSnapshot, BoardStage, NotePriority } from '../../../preload/index';
import { usePlanningStore } from '../../stores/planningStore';
import { PlanningCard } from './PlanningCard';
import { NOTE_MIME, BOARD_STAGE_LABELS } from './constants';
import { isOverWipLimit, parseWipLimit } from './wip';

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

  const wipLimit = usePlanningStore(s => s.wipLimits[stage]);
  const setWipLimit = usePlanningStore(s => s.setWipLimit);
  const [editingLimit, setEditingLimit] = useState(false);
  const overLimit = isOverWipLimit(notes.length, wipLimit);

  const commitLimit = useCallback(
    (raw: string) => {
      setWipLimit(stage, parseWipLimit(raw));
      setEditingLimit(false);
    },
    [setWipLimit, stage]
  );

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
        {editingLimit ? (
          <input
            type="number"
            min={1}
            className="planning-column__wip-input"
            defaultValue={wipLimit ?? ''}
            placeholder="∞"
            autoFocus
            aria-label={`WIP limit for ${BOARD_STAGE_LABELS[stage]}`}
            onBlur={e => commitLimit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitLimit((e.target as HTMLInputElement).value);
              else if (e.key === 'Escape') setEditingLimit(false);
            }}
          />
        ) : (
          <button
            type="button"
            className={`planning-column__count ${overLimit ? 'is-over' : ''}`}
            onClick={() => setEditingLimit(true)}
            title={wipLimit ? `WIP limit ${wipLimit} — click to edit` : 'Set a WIP limit'}
          >
            {wipLimit ? `${notes.length} / ${wipLimit}` : notes.length}
          </button>
        )}
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
        {notes.map(note => (
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
        ))}
        <button
          type="button"
          className="planning-column__add-card"
          onClick={() => onAddCard(stage)}
        >
          <Plus size={14} /> Add card
        </button>
      </div>
    </section>
  );
});
