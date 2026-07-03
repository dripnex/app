import { useMemo, useState } from 'react';
import { KanbanSquare, Network } from 'lucide-react';
import { BOARD_STAGES, PLANNING_NOTEBOOK_ID, INBOX_NOTEBOOK_ID } from '@dripnex/core';
import type { NoteSnapshot, BoardStage, NotePriority } from '../../../preload/index';
import { useNotes, useNoteMutations } from '../../hooks/useNotes';
import { GraphView } from '../GraphView';
import { toast } from '../../ui/primitives';
import { PlanningColumn } from './PlanningColumn';
import { PlanningToolbar } from './PlanningToolbar';
import { computeReorderedIds } from './reorder';
import './PlanningBoard.css';

/** Group notes into board columns (by stage) and sort each column. */
function groupByStage(notes: readonly NoteSnapshot[]): Record<BoardStage, NoteSnapshot[]> {
  const groups: Record<BoardStage, NoteSnapshot[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    in_review: [],
    in_staging: [],
  };
  for (const note of notes) {
    // Notes with no/unknown stage (legacy value, moved-in note) land in Backlog.
    const raw = note.boardStage ?? 'backlog';
    const stage: BoardStage = (BOARD_STAGES as readonly string[]).includes(raw)
      ? (raw as BoardStage)
      : 'backlog';
    groups[stage].push(note);
  }
  for (const stage of BOARD_STAGES) {
    groups[stage].sort(
      (a, b) => (a.boardOrder ?? 0) - (b.boardOrder ?? 0) || b.createdAt.localeCompare(a.createdAt)
    );
  }
  return groups;
}

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
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<NotePriority | null>(null);
  // Scope the query to the Planning notebook in SQL, with no artificial cap, so
  // the board never silently drops aged/high-count cards (repo default is 50).
  const { data: allNotes } = useNotes({
    notebookId: PLANNING_NOTEBOOK_ID,
    limit: 100000,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    archived: 'active',
  });
  const { setBoardStage, setPriority, reorderColumn, createNote, softDeleteNote, moveNote } =
    useNoteMutations();

  const planningNotes = useMemo(
    () =>
      (allNotes ?? []).filter(
        n => n.notebookId === PLANNING_NOTEBOOK_ID && !n.isDeleted && !n.isArchived
      ),
    [allNotes]
  );

  // Full (unfiltered) grouping — used so reordering keeps every card's order
  // contiguous even when a search/tag/priority filter is hiding some cards.
  const unfilteredByStage = useMemo(() => groupByStage(planningNotes), [planningNotes]);

  // Tags present across the board, for the filter dropdown.
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of planningNotes) for (const t of n.tags) set.add(t);
    return [...set].sort();
  }, [planningNotes]);

  const isFiltering = search.trim() !== '' || tagFilter !== null || priorityFilter !== null;

  const clearFilters = () => {
    setSearch('');
    setTagFilter(null);
    setPriorityFilter(null);
  };

  // Apply search + tag + priority filters before grouping into columns.
  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return planningNotes.filter(n => {
      if (priorityFilter && n.priority !== priorityFilter) return false;
      if (tagFilter && !n.tags.includes(tagFilter)) return false;
      if (q) {
        const haystack = `${n.title}\n${n.content}\n${n.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [planningNotes, search, tagFilter, priorityFilter]);

  const notesByStage = useMemo(() => groupByStage(filteredNotes), [filteredNotes]);

  const handleReorder = (
    draggedId: string,
    stage: BoardStage,
    targetId: string | null,
    side: 'above' | 'below' | 'append'
  ) => {
    // Reindex over the FULL column (not the filtered view) so cards hidden by an
    // active filter keep contiguous board_order values.
    const fullIds = unfilteredByStage[stage].map(n => n.id);
    const orderedIds = computeReorderedIds(fullIds, draggedId, targetId, side);
    reorderColumn.mutate({ stage, orderedIds });
  };

  // Menu "Move to <stage>": append to the end of the target column.
  const handleMoveStage = (noteId: string, stage: BoardStage) => {
    handleReorder(noteId, stage, null, 'append');
  };

  const handleSetPriority = (noteId: string, priority: NotePriority) => {
    setPriority.mutate({ id: noteId, priority });
  };

  const handleRemoveFromBoard = async (noteId: string) => {
    // Board membership is notebook-based, so removing = moving the note out of
    // the Planning notebook (nulling the stage alone would just re-group it into
    // Backlog). Sequence the two writes: move first (the authoritative removal),
    // then clear the now-irrelevant stage, so a failure can't leave the note
    // both cleared and still on the board.
    try {
      await moveNote.mutateAsync({ noteId, notebookId: INBOX_NOTEBOOK_ID });
      await setBoardStage.mutateAsync({ id: noteId, boardStage: null });
    } catch {
      toast.error('Could not remove the card from the board');
    }
  };

  const handleDeleteNote = (noteId: string) => {
    softDeleteNote.mutate(noteId);
  };

  const handleAddCard = async (stage: BoardStage) => {
    // Create an empty note in the Planning notebook (defaults to Backlog), move
    // it to the requested column, then open it so the user can start typing.
    // Errors are handled here so the async call sites (column "+" buttons) stay
    // safe fire-and-forget without leaking unhandled rejections.
    try {
      const created = await createNote.mutateAsync({
        content: '',
        notebookId: PLANNING_NOTEBOOK_ID,
      });
      if (stage !== 'backlog') {
        await setBoardStage.mutateAsync({ id: created.id, boardStage: stage });
      }
      onOpenNote(created.id);
    } catch {
      toast.error('Could not add a card');
    }
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

      {mode === 'board' && (
        <PlanningToolbar
          search={search}
          onSearch={setSearch}
          tag={tagFilter}
          onTag={setTagFilter}
          priority={priorityFilter}
          onPriority={setPriorityFilter}
          tags={availableTags}
          isFiltering={isFiltering}
          onClear={clearFilters}
        />
      )}

      {mode === 'board' ? (
        <div className="planning-board__columns">
          {BOARD_STAGES.map(stage => (
            <PlanningColumn
              key={stage}
              stage={stage}
              notes={notesByStage[stage]}
              onReorder={handleReorder}
              onAddCard={handleAddCard}
              onOpenNote={onOpenNote}
              onMoveStage={handleMoveStage}
              onSetPriority={handleSetPriority}
              onRemoveFromBoard={handleRemoveFromBoard}
              onDeleteNote={handleDeleteNote}
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
