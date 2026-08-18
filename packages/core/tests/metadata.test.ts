import { describe, it, expect } from 'vitest';
import {
  extractTitle,
  extractTags,
  countWords,
  isPlaceholderTitle,
} from '../src/domain/metadata.js';

describe('Metadata', () => {
  describe('extractTitle', () => {
    it('extracts title from H1 heading', () => {
      const content = '# My Great Title\n\nSome content here.';
      expect(extractTitle(content)).toBe('My Great Title');
    });

    it('handles H1 with extra spaces', () => {
      const content = '#   Spaced Title  \n\nContent.';
      expect(extractTitle(content)).toBe('Spaced Title');
    });

    it('uses first line as fallback', () => {
      const content = 'No heading here\n\nJust paragraphs.';
      expect(extractTitle(content)).toBe('No heading here');
    });

    it('ignores a heading that is not at the top', () => {
      const content = 'Intro paragraph\n\n# Later heading\n\nBody.';
      expect(extractTitle(content)).toBe('Intro paragraph');
    });

    it('returns fallback for empty content', () => {
      expect(extractTitle('')).toBe('Untitled');
      expect(extractTitle('   ')).toBe('Untitled');
    });

    it('uses custom fallback', () => {
      expect(extractTitle('', 'Custom Default')).toBe('Custom Default');
    });

    it('detects placeholder titles', () => {
      expect(isPlaceholderTitle('Untitled')).toBe(true);
      expect(isPlaceholderTitle('untitled')).toBe(true);
      expect(isPlaceholderTitle('  ')).toBe(true);
      expect(isPlaceholderTitle('Ship the graph')).toBe(false);
    });

    it('truncates very long titles', () => {
      const longTitle = 'A'.repeat(200);
      const content = longTitle + '\n\nContent.';
      expect(extractTitle(content).length).toBeLessThanOrEqual(100);
    });
  });

  describe('extractTags', () => {
    it('extracts single tag', () => {
      const content = 'Some text #javascript here.';
      const tags = extractTags(content);
      expect(tags).toContain('javascript');
      expect(tags.length).toBe(1);
    });

    it('extracts multiple tags', () => {
      const content = 'Tags: #react #typescript #testing';
      const tags = extractTags(content);
      expect(tags).toContain('react');
      expect(tags).toContain('typescript');
      expect(tags).toContain('testing');
    });

    it('normalizes tags to lowercase', () => {
      const content = 'Mixed case #JavaScript #TypeScript';
      const tags = extractTags(content);
      expect(tags).toContain('javascript');
      expect(tags).toContain('typescript');
    });

    it('handles tags with hyphens and underscores', () => {
      const content = '#my-tag #another_tag';
      const tags = extractTags(content);
      expect(tags).toContain('my-tag');
      expect(tags).toContain('another_tag');
    });

    it('deduplicates tags', () => {
      const content = '#javascript #react #javascript';
      const tags = extractTags(content);
      expect(tags.filter(t => t === 'javascript').length).toBe(1);
    });

    it('ignores tags that start with numbers', () => {
      const content = '#123invalid #valid';
      const tags = extractTags(content);
      expect(tags).not.toContain('123invalid');
      expect(tags).toContain('valid');
    });

    it('returns empty array for content without tags', () => {
      const content = 'No tags here, just text.';
      expect(extractTags(content)).toEqual([]);
    });

    it('ignores hashtags inside fenced and inline code', () => {
      const content = ['#real', '', '```js', 'const x = "#fake";', '```', '', 'also `#nope`'].join(
        '\n'
      );
      expect(extractTags(content)).toEqual(['real']);
    });

    it('ignores hashtags inside tilde fences', () => {
      const content = ['~~~', '#fake', '~~~', 'keep #real'].join('\n');
      expect(extractTags(content)).toEqual(['real']);
    });
  });

  describe('countWords', () => {
    it('counts words in plain text', () => {
      expect(countWords('one two three four five')).toBe(5);
    });

    it('counts words ignoring markdown', () => {
      const content = '# Title\n\n**Bold** and *italic* text.';
      // "Title Bold and italic text" = 5 words
      expect(countWords(content)).toBe(5);
    });

    it('ignores code blocks', () => {
      const content = 'Before ```\ncode here\n``` after';
      // "Before after" = 2 words
      expect(countWords(content)).toBe(2);
    });

    it('ignores inline code', () => {
      const content = 'Use `const x = 1` for variables.';
      // "Use for variables" = 3 words
      expect(countWords(content)).toBe(3);
    });

    it('extracts text from links', () => {
      const content = 'Check out [this link](http://example.com) here.';
      // "Check out this link here" = 5 words
      expect(countWords(content)).toBe(5);
    });

    it('returns 0 for empty content', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });
  });
});
