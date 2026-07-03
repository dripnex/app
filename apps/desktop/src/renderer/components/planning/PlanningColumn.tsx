import { memo, useCallback, useState } from 'react';
import type { NoteSnapshot, BoardStage } from '../../../preload/index';
import { PlanningCard } from './PlanningCard';
import { NOTE_MIME, BOARD_STAGE_LABELS } from './constants';

interface PlanningColumnProps {
  readonly stage: BoardStage;
  readonly notes: readonly NoteSnapshot[];
  readonly onDropNote: (noteId: string, stage: BoardStage) => void;
  readonly onOpenNote: (id: string) => void;
}

/** A droppable Kanban column for a single board stage. */
export const PlanningColumn = memo(function PlanningColumn({
  stage,
  notes,
  onDropNote,
  onOpenNote,
}: PlanningColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(NOTE_MIME)) return;
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
      const noteId = e.dataTransfer.getData(NOTE_MIME);
      if (noteId) onDropNote(noteId, stage);
    },
    [onDropNote, stage]
  );

  return (
    <section
      className={`planning-column ${isOver ? 'planning-column--over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label={BOARD_STAGE_LABELS[stage]}
    >
      <header className="planning-column__header">
        <span className="planning-column__title">{BOARD_STAGE_LABELS[stage]}</span>
        <span className="planning-column__count">{notes.length}</span>
      </header>
      <div className="planning-column__cards">
        {notes.map(note => (
          <PlanningCard key={note.id} note={note} onOpen={onOpenNote} />
        ))}
      </div>
    </section>
  );
});
