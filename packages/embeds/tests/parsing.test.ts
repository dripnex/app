/**
 * Embed Parsing Tests
 *
 * Pure domain tests for embed extraction.
 */

import { describe, it, expect } from 'vitest';
import { extractEmbeds, extractEmbedTargets } from '../src/core/parsing.js';
import { getEmbedType } from '../src/core/types.js';

describe('extractEmbeds', () => {
  it('returns empty array for content without embeds', () => {
    const result = extractEmbeds('Just regular markdown content.');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty content', () => {
    const result = extractEmbeds('');
    expect(result).toEqual([]);
  });

  it('extracts single embed', () => {
    const result = extractEmbeds('Check this ![[diagram.png]]');
    expect(result).toEqual([{ target: 'diagram.png' }]);
  });

  it('extracts embed with display text', () => {
    const result = extractEmbeds('See ![[spec.pdf|PDF Specification]]');
    expect(result).toEqual([{ target: 'spec.pdf', display: 'PDF Specification' }]);
  });

  it('extracts multiple embeds', () => {
    const result = extractEmbeds('![[image1.png]] and ![[image2.jpg|Photo]]');
    expect(result).toEqual([
      { target: 'image1.png' },
      { target: 'image2.jpg', display: 'Photo' },
    ]);
  });

  it('handles embeds with paths', () => {
    const result = extractEmbeds('![[assets/images/logo.svg]]');
    expect(result).toEqual([{ target: 'assets/images/logo.svg' }]);
  });

  it('ignores wikilinks (no ! prefix)', () => {
    const result = extractEmbeds('Link to [[note]] is not an embed');
    expect(result).toEqual([]);
  });

  it('handles mixed wikilinks and embeds', () => {
    const result = extractEmbeds('See [[note]] and ![[image.png]]');
    expect(result).toEqual([{ target: 'image.png' }]);
  });

  it('trims whitespace from target and display', () => {
    const result = extractEmbeds('![[  file.png  |  Label  ]]');
    expect(result).toEqual([{ target: 'file.png', display: 'Label' }]);
  });

  it('handles embeds in multiline content', () => {
    const content = `
# Title

![[header.png]]

Some text with ![[inline.gif|GIF]] embed.

![[footer.svg]]
    `;
    const result = extractEmbeds(content);
    expect(result).toEqual([
      { target: 'header.png' },
      { target: 'inline.gif', display: 'GIF' },
      { target: 'footer.svg' },
    ]);
  });
});

describe('extractEmbedTargets', () => {
  it('returns unique targets', () => {
    const result = extractEmbedTargets('![[a.png]] ![[b.png]] ![[a.png]]');
    expect(result).toEqual(['a.png', 'b.png']);
  });

  it('deduplicates case-insensitive', () => {
    const result = extractEmbedTargets('![[Image.PNG]] ![[image.png]]');
    expect(result).toEqual(['Image.PNG']);
  });
});

describe('getEmbedType', () => {
  it('detects image types', () => {
    expect(getEmbedType('photo.png')).toBe('image');
    expect(getEmbedType('photo.jpg')).toBe('image');
    expect(getEmbedType('photo.jpeg')).toBe('image');
    expect(getEmbedType('photo.gif')).toBe('image');
    expect(getEmbedType('photo.svg')).toBe('image');
    expect(getEmbedType('photo.webp')).toBe('image');
  });

  it('detects video types', () => {
    expect(getEmbedType('video.mp4')).toBe('video');
    expect(getEmbedType('video.webm')).toBe('video');
    expect(getEmbedType('video.mov')).toBe('video');
  });

  it('detects audio types', () => {
    expect(getEmbedType('audio.mp3')).toBe('audio');
    expect(getEmbedType('audio.wav')).toBe('audio');
    expect(getEmbedType('audio.ogg')).toBe('audio');
  });

  it('detects PDF', () => {
    expect(getEmbedType('document.pdf')).toBe('pdf');
  });

  it('returns unknown for other types', () => {
    expect(getEmbedType('file.txt')).toBe('unknown');
    expect(getEmbedType('file.doc')).toBe('unknown');
    expect(getEmbedType('noextension')).toBe('unknown');
  });

  it('handles uppercase extensions', () => {
    expect(getEmbedType('photo.PNG')).toBe('image');
    expect(getEmbedType('video.MP4')).toBe('video');
    expect(getEmbedType('document.PDF')).toBe('pdf');
  });
});
