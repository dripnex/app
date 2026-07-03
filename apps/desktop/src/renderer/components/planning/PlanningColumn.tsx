import { memo, useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import type { NoteSnapshot, BoardStage } from '../../../preload/index';
import { PlanningCard } from './PlanningCard';
import { NOTE_MIME, BOARD_STAGE_LABELS } from './constants';

interface PlanningColumnProps {
  readonly stage: BoardStage;
  readonly notes: readonly NoteSnapshot[];
  readonly onDropNote: (noteId: string, stage: BoardStage) => void;
  readonly onAddCard: (stage: BoardStage) => void;
  readonly onOpenNote: (id: string) => void;
  readonly onMoveStage: (id: string, stage: BoardStage) => void;
  readonly onRemoveFromBoard: (id: string) => void;
  readonly onDeleteNote: (id: string) => void;
}

/** A droppable Kanban column for a single board stage. */
export const PlanningColumn = memo(function PlanningColumn({
  stage,
  notes,
  onDropNote,
  onAddCard,
  onOpenNote,
  onMoveStage,
  onRemoveFromBoard,
  onDeleteNote,
}: PlanningColumnProps) {
  const [isOver, setIsOver] = useState(false);

  // A card carries either our custom MIME or (as a fallback) text/plain. Some
  // Chromium/Electron builds don't enumerate custom types in `types` during
  // dragover, so we must not gate preventDefault() on that check — otherwise the
  // drop event never fires. We allow the drop and only read the id on drop.
  const allowDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Only clear when the pointer actually leaves the column (not a child).
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);
      // getData reads custom types reliably on drop (the enumeration quirk only
      // affects dragover). Reading our MIME avoids acting on notebook drags,
      // which also set text/plain.
      const noteId = e.dataTransfer.getData(NOTE_MIME);
      if (noteId) onDropNote(noteId, stage);
    },
    [onDropNote, stage]
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
              onRemoveFromBoard={onRemoveFromBoard}
              onDelete={onDeleteNote}
            />
          ))
        )}
      </div>
    </section>
  );
});
