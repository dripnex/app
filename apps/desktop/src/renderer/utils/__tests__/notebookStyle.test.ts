import { describe, expect, it } from 'vitest';
import { notebookStyleClass, notebookStyleProps, notebookStyleSelector } from '../notebookStyle';

describe('notebookStyle', () => {
  it('builds a CSS class and attribute selector', () => {
    expect(notebookStyleClass('inbox')).toBe('notebook-inbox');
    expect(notebookStyleClass('Work / API')).toBe('notebook-Work-API');
    expect(notebookStyleSelector('inbox')).toBe('[data-notebook-id="inbox"]');
  });

  it('omits the hook when there is no notebook', () => {
    expect(notebookStyleProps(null)).toEqual({ className: 'dripnex-note' });
    expect(notebookStyleProps('inbox')).toEqual({
      'data-notebook-id': 'inbox',
      className: 'dripnex-note notebook-inbox',
    });
  });
});
