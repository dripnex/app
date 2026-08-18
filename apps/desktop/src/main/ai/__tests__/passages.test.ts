import { describe, expect, it } from 'vitest';
import { headingFrom, pickPassages } from '../passages.js';

describe('headingFrom', () => {
  it('reads the first heading line', () => {
    expect(headingFrom('# Recipe\n\nMix flour.')).toBe('Recipe');
    expect(headingFrom('plain text')).toBeNull();
  });
});

describe('pickPassages', () => {
  it('prefers the chunk that mentions the query', () => {
    const [picked] = pickPassages(
      { id: 'n1', title: 'Cookbook', content: 'full note ignored when stored chunks exist' },
      'flour',
      [
        { content: '# Intro\n\nHello there.', heading: 'Intro' },
        { content: '# Bread\n\nUse strong flour and water.', heading: 'Bread' },
      ]
    );
    expect(picked!.heading).toBe('Bread');
    expect(picked!.content).toMatch(/flour/i);
  });

  it('uses stored chunks when provided', () => {
    const [picked] = pickPassages(
      { id: 'n1', title: 'Note', content: 'ignored full body' },
      'alpha',
      [
        { content: '# One\n\nzzz', heading: 'One' },
        { content: '# Two\n\nalpha beta', heading: 'Two' },
      ]
    );
    expect(picked!.heading).toBe('Two');
    expect(picked!.content).toContain('alpha');
  });
});
