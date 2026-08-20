export interface NoteHistoryState {
  stack: string[];
  index: number;
}

export const emptyNoteHistory = (): NoteHistoryState => ({ stack: [], index: -1 });

const MAX = 50;

export function visitNote(state: NoteHistoryState, id: string): NoteHistoryState {
  if (state.stack[state.index] === id) return state;
  const trimmed = state.stack.slice(0, state.index + 1);
  const stack = [...trimmed, id].slice(-MAX);
  return { stack, index: stack.length - 1 };
}

export function historyBack(state: NoteHistoryState): {
  state: NoteHistoryState;
  id: string | null;
} {
  if (state.index <= 0) return { state, id: null };
  const index = state.index - 1;
  return { state: { ...state, index }, id: state.stack[index] ?? null };
}

export function historyForward(state: NoteHistoryState): {
  state: NoteHistoryState;
  id: string | null;
} {
  if (state.index < 0 || state.index >= state.stack.length - 1) {
    return { state, id: null };
  }
  const index = state.index + 1;
  return { state: { ...state, index }, id: state.stack[index] ?? null };
}

export function canGoBack(state: NoteHistoryState): boolean {
  return state.index > 0;
}

export function canGoForward(state: NoteHistoryState): boolean {
  return state.index >= 0 && state.index < state.stack.length - 1;
}
