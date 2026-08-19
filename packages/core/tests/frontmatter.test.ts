import { describe, expect, it } from 'vitest';
import {
  applyTemplateFrontmatter,
  noteInstruction,
  noteSkill,
  parseNoteFrontmatter,
  serializeFrontmatter,
} from '../src/domain/frontmatter.js';
import { extractTitle } from '../src/domain/metadata.js';

describe('parseNoteFrontmatter', () => {
  it('returns the original body when there is no fence', () => {
    const parsed = parseNoteFrontmatter('# Meeting\n\nNotes');
    expect(parsed.hasFrontmatter).toBe(false);
    expect(parsed.body).toBe('# Meeting\n\nNotes');
    expect(parsed.fields).toEqual({});
  });

  it('reads instruction and skill', () => {
    const parsed = parseNoteFrontmatter(
      [
        '---',
        'instruction: File as a meeting note.',
        'skill: meeting',
        '---',
        '# Meeting',
        '',
      ].join('\n')
    );
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.fields.instruction).toBe('File as a meeting note.');
    expect(parsed.fields.skill).toBe('meeting');
    expect(parsed.body).toBe('# Meeting\n');
    expect(noteInstruction(parsed.body)).toBeNull();
    expect(
      noteInstruction(
        ['---', 'instruction: File as a meeting note.', '---', '# Meeting'].join('\n')
      )
    ).toBe('File as a meeting note.');
    expect(noteSkill(['---', 'skill: meeting', '---', '# Meeting'].join('\n'))).toBe('meeting');
  });

  it('reads a block instruction', () => {
    const content = [
      '---',
      'instruction: |',
      '  Capture attendees.',
      '  Do not invent names.',
      '---',
      '# Meeting',
    ].join('\n');
    expect(noteInstruction(content)).toBe('Capture attendees.\nDo not invent names.');
  });
});

describe('applyTemplateFrontmatter', () => {
  it('copies instruction onto a new body', () => {
    const template = ['---', 'instruction: File as a meeting note.', '---', '# Meeting'].join('\n');
    expect(applyTemplateFrontmatter(template, '# Today\n\n-')).toBe(
      ['---', 'instruction: File as a meeting note.', '---', '# Today\n\n-'].join('\n')
    );
  });

  it('leaves a body alone when the template has no instruction', () => {
    expect(applyTemplateFrontmatter('# Meeting', '# Today')).toBe('# Today');
  });
});

describe('serializeFrontmatter', () => {
  it('writes a block when the value has newlines', () => {
    expect(serializeFrontmatter({ instruction: 'One\nTwo' }, '# Body')).toBe(
      ['---', 'instruction: |', '  One', '  Two', '---', '# Body'].join('\n')
    );
  });
});

describe('extractTitle with frontmatter', () => {
  it('skips the fence and uses the first body line', () => {
    expect(
      extractTitle(['---', 'instruction: File this.', '---', '# Meeting', '', 'Notes'].join('\n'))
    ).toBe('Meeting');
  });
});
