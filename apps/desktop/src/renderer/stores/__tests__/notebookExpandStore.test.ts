import { describe, expect, it, beforeEach } from 'vitest';
import { useNotebookExpandStore } from '../notebookExpandStore';

describe('notebookExpandStore', () => {
  beforeEach(() => {
    useNotebookExpandStore.setState({ collapsedIds: [] });
  });

  it('treats notebooks as expanded by default', () => {
    expect(useNotebookExpandStore.getState().isExpanded('work')).toBe(true);
  });

  it('toggles collapse', () => {
    useNotebookExpandStore.getState().toggle('work');
    expect(useNotebookExpandStore.getState().isExpanded('work')).toBe(false);
    useNotebookExpandStore.getState().toggle('work');
    expect(useNotebookExpandStore.getState().isExpanded('work')).toBe(true);
  });
});
