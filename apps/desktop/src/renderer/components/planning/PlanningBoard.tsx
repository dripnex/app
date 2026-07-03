import { useMemo, useState } from 'react';
import { KanbanSquare, Network } from 'lucide-react';
import { BOARD_STAGES, PLANNING_NOTEBOOK_ID } from '@dripnex/core';
import type { NoteSnapshot, BoardStage } from '../../../preload/index';
import { useNotes, useNoteMutations } from '../../hooks/useNotes';
import { GraphView } from '../GraphView';
import { PlanningColumn } from './PlanningColumn';
import './PlanningBoard.css';

interface PlanningBoardProps {
  /** Open a note in the editor (leaves the board). */
  readonly onOpenNote: (id: string) => void;
}

type ViewMode = 'board' | 'graph';

/**
 * The Planning view: a Linear-style Kanban board over the notes in the
 * reserved Planning notebook, plus a graph mode that reuses GraphView filtered
 * to those same notes. Dragging a card persists its stage via boardStage
 * (DB metadata only — never rewrites the note's markdown).
 */
export function PlanningBoard({ onOpenNote }: PlanningBoardProps) {
  const [mode, setMode] = useState<ViewMode>('board');
  const { data: allNotes } = useNotes({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    archived: 'active',
  });
  const { setBoardStage } = useNoteMutations();

  const planningNotes = useMemo(
    () =>
      (allNotes ?? []).filter(
        n => n.notebookId === PLANNING_NOTEBOOK_ID && !n.isDeleted && !n.isArchived
      ),
    [allNotes]
  );

  const notesByStage = useMemo(() => {
    const groups: Record<BoardStage, NoteSnapshot[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      in_staging: [],
    };
    for (const note of planningNotes) {
      // Notes with no explicit stage (e.g. moved into the notebook) land in Backlog.
      const stage = note.boardStage ?? 'backlog';
      groups[stage].push(note);
    }
    return groups;
  }, [planningNotes]);

  const handleDropNote = (noteId: string, stage: BoardStage) => {
    setBoardStage.mutate({ id: noteId, boardStage: stage });
  };

  return (
    <div className="planning-board">
      <header className="planning-board__header">
        <h2 className="planning-board__title">Planning</h2>
        <div className="planning-board__toggle" role="tablist" aria-label="Planning view mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'board'}
            className={`planning-board__toggle-btn ${mode === 'board' ? 'is-active' : ''}`}
            onClick={() => setMode('board')}
          >
            <KanbanSquare size={14} /> Board
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'graph'}
            className={`planning-board__toggle-btn ${mode === 'graph' ? 'is-active' : ''}`}
            onClick={() => setMode('graph')}
          >
            <Network size={14} /> Graph
          </button>
        </div>
      </header>

      {mode === 'board' ? (
        <div className="planning-board__columns">
          {BOARD_STAGES.map(stage => (
            <PlanningColumn
              key={stage}
              stage={stage}
              notes={notesByStage[stage]}
              onDropNote={handleDropNote}
              onOpenNote={onOpenNote}
            />
          ))}
        </div>
      ) : (
        <div className="planning-board__graph">
          <GraphView filterNotebookId={PLANNING_NOTEBOOK_ID} onNodeClick={onOpenNote} />
        </div>
      )}
    </div>
  );
}
