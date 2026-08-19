/**
 * Parsing Tests
 *
 * Pure domain tests for wikilink extraction.
 * No mocks needed - these are pure functions.
 */

import { describe, it, expect } from 'vitest';
import { extractWikilinks, extractWikilinkTargets, parseWikilinkAt } from '../src/core/parsing.js';

describe('extractWikilinks', () => {
  it('extracts simple [[target]] wikilink', () => {
    const result = extractWikilinks('See [[Note A]] for details');
    expect(result).toEqual([{ target: 'Note A' }]);
  });

  it('extracts [[target|display]] with alias', () => {
    const result = extractWikilinks('Check [[Note B|my note]] here');
    expect(result).toEqual([{ target: 'Note B', display: 'my note' }]);
  });

  it('extracts multiple wikilinks from text', () => {
    const result = extractWikilinks('See [[Note A]] and [[Note B|alias]] and [[Note C]]');
    expect(result).toEqual([
      { target: 'Note A' },
      { target: 'Note B', display: 'alias' },
      { target: 'Note C' },
    ]);
  });

  it('deduplicates by target (case-insensitive)', () => {
    const result = extractWikilinks('[[Note A]] and [[note a]] and [[NOTE A]]');
    expect(result).toEqual([{ target: 'Note A' }]);
  });

  it('preserves first occurrence display text when deduplicating', () => {
    const result = extractWikilinks('[[Note|first]] and [[Note|second]]');
    expect(result).toEqual([{ target: 'Note', display: 'first' }]);
  });

  it('trims whitespace from target and display', () => {
    const result = extractWikilinks('[[  Note A  |  display text  ]]');
    expect(result).toEqual([{ target: 'Note A', display: 'display text' }]);
  });

  it('returns empty array for text without wikilinks', () => {
    const result = extractWikilinks('Just regular text without links');
    expect(result).toEqual([]);
  });

  it('ignores unclosed brackets', () => {
    const result = extractWikilinks('[[unclosed and [[Valid Note]]');
    expect(result).toEqual([{ target: 'Valid Note' }]);
  });

  it('handles wikilinks at start and end of text', () => {
    const result = extractWikilinks('[[Start]] middle [[End]]');
    expect(result).toEqual([{ target: 'Start' }, { target: 'End' }]);
  });

  it('handles wikilinks on multiple lines', () => {
    const result = extractWikilinks('Line 1 [[Note A]]\nLine 2 [[Note B]]');
    expect(result).toEqual([{ target: 'Note A' }, { target: 'Note B' }]);
  });

  it('handles wikilinks with special characters in target', () => {
    const result = extractWikilinks('[[2024-01-15 Daily Note]]');
    expect(result).toEqual([{ target: '2024-01-15 Daily Note' }]);
  });

  it('handles wikilinks with unicode characters', () => {
    const result = extractWikilinks('[[日本語ノート]]');
    expect(result).toEqual([{ target: '日本語ノート' }]);
  });

  it('ignores empty wikilinks', () => {
    const result = extractWikilinks('[[]] and [[  ]] and [[Valid]]');
    expect(result).toEqual([{ target: 'Valid' }]);
  });

  it('extracts same-note heading links', () => {
    expect(extractWikilinks('Jump [[#Setup]]')).toEqual([{ target: '', anchor: 'Setup' }]);
    expect(extractWikilinkTargets('Jump [[#Setup]] and [[Note A]]')).toEqual(['Note A']);
  });

  it('handles consecutive wikilinks without space', () => {
    const result = extractWikilinks('[[A]][[B]][[C]]');
    expect(result).toEqual([{ target: 'A' }, { target: 'B' }, { target: 'C' }]);
  });

  it('does not treat embeds ![[file]] as wikilinks', () => {
    const result = extractWikilinks('See [[Note A]] and ![[photo.png]]');
    expect(result).toEqual([{ target: 'Note A' }]);
  });

  it('ignores wikilinks inside fenced and inline code', () => {
    const result = extractWikilinks('[[Real]]\n```\n[[Fake]]\n```\nand `[[also-fake]]`');
    expect(result).toEqual([{ target: 'Real' }]);
  });

  it('ignores wikilinks inside tilde fences', () => {
    const result = extractWikilinks('[[Real]]\n~~~\n[[Fake]]\n~~~');
    expect(result).toEqual([{ target: 'Real' }]);
  });
});

describe('extractWikilinkTargets', () => {
  it('returns array of target strings', () => {
    const result = extractWikilinkTargets('See [[Note A]] and [[Note B|alias]]');
    expect(result).toEqual(['Note A', 'Note B']);
  });

  it('returns empty array for no wikilinks', () => {
    const result = extractWikilinkTargets('No links here');
    expect(result).toEqual([]);
  });

  it('deduplicates targets', () => {
    const result = extractWikilinkTargets('[[Note]] and [[Note]] again');
    expect(result).toEqual(['Note']);
  });
});

describe('parseWikilinkAt', () => {
  it('finds target, heading, and alias at a cursor', () => {
    const line = 'See [[Note A#Setup|here]] now';
    expect(parseWikilinkAt(line, 6)).toEqual({
      target: 'Note A',
      anchor: 'Setup',
      display: 'here',
    });
    expect(parseWikilinkAt(line, 0)).toBeNull();
    expect(parseWikilinkAt('Jump [[#Setup]]', 8)).toEqual({ target: '', anchor: 'Setup' });
  });

  it('includes the opening and closing brackets', () => {
    const line = '[[Note]]';
    expect(parseWikilinkAt(line, 0)).toEqual({ target: 'Note' });
    expect(parseWikilinkAt(line, line.length)).toEqual({ target: 'Note' });
  });

  it('picks the span that contains the cursor', () => {
    const line = '[[A]] then [[B#H|x]]';
    expect(parseWikilinkAt(line, 2)).toEqual({ target: 'A' });
    expect(parseWikilinkAt(line, 12)).toEqual({ target: 'B', anchor: 'H', display: 'x' });
  });

  it('rejects empty and incomplete tokens', () => {
    expect(parseWikilinkAt('[[]]', 1)).toBeNull();
    expect(parseWikilinkAt('[[#]]', 1)).toBeNull();
    expect(parseWikilinkAt('[[Note', 2)).toBeNull();
  });
});
