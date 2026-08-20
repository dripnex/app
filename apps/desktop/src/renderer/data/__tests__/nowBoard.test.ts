import { describe, it, expect } from 'vitest';
import {
  NOW_BOARD_CONTENT,
  NOW_BOARD_ID,
  NOW_BOARD_NOTEBOOK_ID,
  NOW_BOARD_TAGS,
} from '../nowBoard';

describe('nowBoard', () => {
  it('uses a stable reserved id in Inbox', () => {
    expect(NOW_BOARD_ID).toBe('dripnex-now');
    expect(NOW_BOARD_NOTEBOOK_ID).toBe('inbox');
  });

  it('is searchable by the living-board keywords', () => {
    expect(NOW_BOARD_CONTENT).toContain('Now / Next / Not');
    expect(NOW_BOARD_CONTENT).toContain('#now');
    expect(NOW_BOARD_CONTENT).toContain('#roadmap');
    expect(NOW_BOARD_TAGS).toEqual(['now', 'roadmap', 'debt']);
  });
});
