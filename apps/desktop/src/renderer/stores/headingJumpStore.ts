import { create } from 'zustand';

interface HeadingJumpState {
  noteId: string | null;
  heading: string | null;
  request: (noteId: string, heading: string) => void;
  consume: (noteId: string) => string | null;
}

export const useHeadingJumpStore = create<HeadingJumpState>((set, get) => ({
  noteId: null,
  heading: null,
  request(noteId, heading) {
    const trimmed = heading.trim();
    if (!trimmed) return;
    set({ noteId, heading: trimmed });
  },
  consume(noteId) {
    const state = get();
    if (state.noteId !== noteId || !state.heading) return null;
    const heading = state.heading;
    set({ noteId: null, heading: null });
    return heading;
  },
}));
