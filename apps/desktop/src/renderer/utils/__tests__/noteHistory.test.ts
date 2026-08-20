import { describe, expect, it } from 'vitest';
import {
  canGoBack,
  canGoForward,
  emptyNoteHistory,
  historyBack,
  historyForward,
  visitNote,
} from '../noteHistory';

describe('noteHistory', () => {
  it('visits and walks back and forward', () => {
    let state = emptyNoteHistory();
    state = visitNote(state, 'a');
    state = visitNote(state, 'b');
    state = visitNote(state, 'c');

    expect(canGoBack(state)).toBe(true);
    expect(canGoForward(state)).toBe(false);

    const back = historyBack(state);
    expect(back.id).toBe('b');
    expect(canGoForward(back.state)).toBe(true);

    const fwd = historyForward(back.state);
    expect(fwd.id).toBe('c');
  });

  it('does not record the same note twice in a row', () => {
    let state = visitNote(emptyNoteHistory(), 'a');
    state = visitNote(state, 'a');
    expect(state.stack).toEqual(['a']);
  });

  it('drops forward entries after a new visit', () => {
    let state = visitNote(emptyNoteHistory(), 'a');
    state = visitNote(state, 'b');
    state = historyBack(state).state;
    state = visitNote(state, 'c');
    expect(state.stack).toEqual(['a', 'c']);
    expect(canGoForward(state)).toBe(false);
  });
});
