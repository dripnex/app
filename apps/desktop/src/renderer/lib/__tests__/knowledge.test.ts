import { describe, expect, it } from 'vitest';
import { isKindTag, kindFromTags, tagsWithKind } from '../knowledge';

describe('kindFromTags', () => {
  it('reads a reserved tag', () => {
    expect(kindFromTags(['inbox', 'person'])).toBe('person');
  });

  it('treats non-active status as a task when no kind tag exists', () => {
    expect(kindFromTags(['inbox'], 'completed')).toBe('task');
  });

  it('defaults to concept', () => {
    expect(kindFromTags([])).toBe('concept');
  });
});

describe('tagsWithKind', () => {
  it('swaps the reserved tag and keeps the rest', () => {
    expect(tagsWithKind(['inbox', 'concept'], 'idea')).toEqual(['inbox', 'idea']);
  });

  it('recognizes hashed kind tags', () => {
    expect(isKindTag('#Task')).toBe(true);
  });
});
