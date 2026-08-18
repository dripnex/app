/**
 * Task Parsing Tests
 *
 * Pure domain tests for task counting.
 * No mocks needed - these are pure functions.
 */

import { describe, it, expect } from 'vitest';
import { countMarkdownTasks } from '../src/core/parsing.js';

describe('countMarkdownTasks', () => {
  it('returns zero for content without tasks', () => {
    const result = countMarkdownTasks('Just regular markdown content.');
    expect(result).toEqual({ total: 0, completed: 0 });
  });

  it('returns zero for empty content', () => {
    const result = countMarkdownTasks('');
    expect(result).toEqual({ total: 0, completed: 0 });
  });

  it('counts single unchecked task', () => {
    const result = countMarkdownTasks('- [ ] todo item');
    expect(result).toEqual({ total: 1, completed: 0 });
  });

  it('counts single checked task', () => {
    const result = countMarkdownTasks('- [x] done item');
    expect(result).toEqual({ total: 1, completed: 1 });
  });

  it('counts uppercase X as completed', () => {
    const result = countMarkdownTasks('- [X] done item');
    expect(result).toEqual({ total: 1, completed: 1 });
  });

  it('counts multiple mixed tasks', () => {
    const content = `
- [x] done
- [ ] todo
- [x] also done
- [ ] another todo
    `;
    const result = countMarkdownTasks(content);
    expect(result).toEqual({ total: 4, completed: 2 });
  });

  it('handles asterisk task lists', () => {
    const content = `
* [x] done with asterisk
* [ ] todo with asterisk
    `;
    const result = countMarkdownTasks(content);
    expect(result).toEqual({ total: 2, completed: 1 });
  });

  it('handles mixed dash and asterisk', () => {
    const content = `
- [x] done dash
* [ ] todo asterisk
    `;
    const result = countMarkdownTasks(content);
    expect(result).toEqual({ total: 2, completed: 1 });
  });

  it('handles tasks with leading whitespace (nested)', () => {
    const content = `
- [x] parent done
  - [ ] nested todo
    - [x] deeply nested done
    `;
    const result = countMarkdownTasks(content);
    expect(result).toEqual({ total: 3, completed: 2 });
  });

  it('ignores inline checkbox-like patterns', () => {
    const result = countMarkdownTasks('This is [ ] not a task');
    expect(result).toEqual({ total: 0, completed: 0 });
  });

  it('ignores tasks inside fenced code', () => {
    const content = ['- [x] real', '```', '- [ ] fake', '```', '- [ ] also real'].join('\n');
    expect(countMarkdownTasks(content)).toEqual({ total: 2, completed: 1 });
  });

  it('handles tasks mixed with regular text', () => {
    const content = `
# Title

Some paragraph text.

- [x] First task
- [ ] Second task

More text here.

- Regular list item
- [x] Third task
    `;
    const result = countMarkdownTasks(content);
    expect(result).toEqual({ total: 3, completed: 2 });
  });
});
