import { create } from 'zustand';

interface PreviewFindStore {
  open: boolean;
  query: string;
  index: number;
  openPanel: () => void;
  closePanel: () => void;
  setQuery: (query: string) => void;
  setIndex: (index: number) => void;
  step: (direction: 1 | -1, count: number) => void;
}

export const usePreviewFindStore = create<PreviewFindStore>()((set, get) => ({
  open: false,
  query: '',
  index: 0,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false, index: 0 }),
  setQuery: query => set({ query, index: 0 }),
  setIndex: index => set({ index }),
  step: (direction, count) => {
    if (count <= 0) return;
    const next = (get().index + direction + count) % count;
    set({ index: next });
  },
}));
