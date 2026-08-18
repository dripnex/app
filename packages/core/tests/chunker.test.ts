import { describe, expect, it } from 'vitest';
import { chunkMarkdown, estimateChunkTokens } from '../src/domain/chunker.js';

describe('estimateChunkTokens', () => {
  it('is ceil(len/4) and 0 for empty', () => {
    expect(estimateChunkTokens('')).toBe(0);
    expect(estimateChunkTokens('abcd')).toBe(1);
    expect(estimateChunkTokens('abcde')).toBe(2);
  });
});

describe('chunkMarkdown', () => {
  it('returns nothing for blank input', () => {
    expect(chunkMarkdown('')).toEqual([]);
    expect(chunkMarkdown('   \n\n  ')).toEqual([]);
  });

  it('keeps a short note as one chunk', () => {
    const chunks = chunkMarkdown('# Hello\n\nA short note.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.heading).toBe('Hello');
    expect(chunks[0]!.content).toContain('# Hello');
    expect(chunks[0]!.content).toContain('A short note.');
  });

  it('does not mutate the source string', () => {
    const source = '# Title\n\nBody paragraph.';
    const copy = source.slice();
    chunkMarkdown(source, { maxTokens: 8 });
    expect(source).toBe(copy);
  });

  it('splits a long paragraph and overlaps the next chunk', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog.';
    const body = Array.from({ length: 20 }, () => sentence).join(' ');
    const chunks = chunkMarkdown(body, { maxTokens: 40, overlapTokens: 8 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map(chunk => chunk.index)).toEqual(chunks.map((_, i) => i));
    expect(chunks[1]!.content.startsWith(chunks[0]!.content)).toBe(false);
    const overlap = chunks[1]!.content.slice(0, 20);
    expect(chunks[0]!.content.includes(overlap.trim().slice(0, 8))).toBe(true);
  });

  it('does not split a fenced code block', () => {
    const code = ['```ts', 'const x = 1;', 'const y = 2;', 'const z = x + y;', '```'].join('\n');
    const chunks = chunkMarkdown(`# Code\n\n${code}`, { maxTokens: 8, overlapTokens: 0 });
    const joined = chunks.map(chunk => chunk.content).join('\n');
    expect(joined).toContain('```ts');
    expect(joined).toContain('const z = x + y;');
    expect(joined).toContain('```');
    expect(
      chunks.some(chunk => chunk.content.includes('```ts') && !chunk.content.includes('```'))
    ).toBe(false);
  });

  it('tracks the last heading as chunk metadata', () => {
    const markdown = [
      '# One',
      '',
      'First section body that is short.',
      '',
      '## Two',
      '',
      'Second section body that is also short.',
    ].join('\n');
    const chunks = chunkMarkdown(markdown, { maxTokens: 20, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]!.heading).toBe('One');
    expect(chunks.some(chunk => chunk.heading === 'Two')).toBe(true);
  });

  it('assigns sequential indexes', () => {
    const body = Array.from(
      { length: 40 },
      (_, i) => `Paragraph number ${i} with extra words.`
    ).join('\n\n');
    const chunks = chunkMarkdown(body, { maxTokens: 30, overlapTokens: 4 });
    expect(chunks.map(chunk => chunk.index)).toEqual(chunks.map((_, i) => i));
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBe(estimateChunkTokens(chunk.content));
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });
});
