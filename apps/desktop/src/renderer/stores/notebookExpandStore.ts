import { create } from 'zustand';

/** Notebooks default to expanded. This set is the collapsed ones. */
interface NotebookExpandStore {
  collapsedIds: string[];
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  expand: (id: string) => void;
}

export const useNotebookExpandStore = create<NotebookExpandStore>((set, get) => ({
  collapsedIds: [],
  isExpanded: id => !get().collapsedIds.includes(id),
  toggle: id =>
    set(state => ({
      collapsedIds: state.collapsedIds.includes(id)
        ? state.collapsedIds.filter(item => item !== id)
        : [...state.collapsedIds, id],
    })),
  expand: id =>
    set(state => ({
      collapsedIds: state.collapsedIds.filter(item => item !== id),
    })),
}));
