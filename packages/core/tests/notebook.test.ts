import { describe, it, expect } from 'vitest';
import {
  canDelete,
  createInboxNotebook,
  createNotebook,
  createTemplatesNotebook,
  isReservedNotebook,
  setNotebookIcon,
} from '../src/domain/notebook.js';
import { TEMPLATES_NOTEBOOK_ID } from '../src/domain/types.js';

describe('notebooks', () => {
  it('creates a reserved templates notebook', () => {
    const notebook = createTemplatesNotebook();
    expect(notebook.id).toBe(TEMPLATES_NOTEBOOK_ID);
    expect(notebook.name).toBe('Note Templates');
    expect(isReservedNotebook(notebook)).toBe(true);
    expect(canDelete(notebook)).toBe(false);
  });

  it('keeps inbox undeletable', () => {
    const inbox = createInboxNotebook();
    expect(canDelete(inbox)).toBe(false);
  });

  it('sets and clears a sidebar icon', () => {
    const notebook = createNotebook({ name: 'Ideas' });
    expect(notebook.icon).toBeNull();
    const withIcon = setNotebookIcon(notebook, 'lightbulb');
    expect(withIcon.icon).toBe('lightbulb');
    expect(setNotebookIcon(withIcon, null).icon).toBeNull();
  });
});
