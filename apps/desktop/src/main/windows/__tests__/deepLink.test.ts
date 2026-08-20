import { describe, expect, it } from 'vitest';
import { parseDripnexUrl } from '../deepLink';

describe('parseDripnexUrl (main re-export)', () => {
  it('uses the shared parser', () => {
    expect(parseDripnexUrl('dripnex://note/n1#intro')).toEqual({
      kind: 'note',
      noteId: 'n1',
      heading: 'intro',
    });
  });
});
