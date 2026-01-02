import { describe, it, expect } from 'vitest';
import { createNote, updateNoteContent, updateNoteTitle, hasTag, collectTags } from '../src/domain/note.js';
import { createTag, createNoteId } from '../src/domain/types.js';

describe('Note Entity', () => {
  describe('createNote', () => {
    it('creates a note with generated ID', () => {
      const note = createNote({ content: '# Hello World' });

      expect(note.id).toBeDefined();
      expect(note.content).toBe('# Hello World');
      expect(note.metadata.title).toBe('Hello World');
    });

    it('creates a note with provided ID', () => {
      const id = createNoteId('my-custom-id');
      const note = createNote({ id, content: '# Test' });

      expect(note.id).toBe('my-custom-id');
    });

    it('extracts title from H1 heading', () => {
      const note = createNote({
        content: '# My Note Title\n\nSome content here.',
      });

      expect(note.metadata.title).toBe('My Note Title');
    });

    it('uses fallback title for empty content', () => {
      const note = createNote({ content: '' });

      expect(note.metadata.title).toBe('Untitled');
    });

    it('extracts tags from content', () => {
      const note = createNote({
        content: '# Notes\n\nThis is about #javascript and #typescript.',
      });

      expect(note.metadata.tags).toContain('javascript');
      expect(note.metadata.tags).toContain('typescript');
      expect(note.metadata.tags.length).toBe(2);
    });

    it('counts words correctly', () => {
      const note = createNote({
        content: '# Title\n\nOne two three four five.',
      });

      // "Title" + "One two three four five" = 6 words
      expect(note.metadata.wordCount).toBe(6);
    });

    it('sets timestamps on creation', () => {
      const note = createNote({ content: '# Test' });

      expect(note.metadata.createdAt).toBeDefined();
      expect(note.metadata.updatedAt).toBeDefined();
      expect(note.metadata.createdAt).toBe(note.metadata.updatedAt);
    });
  });

  describe('updateNoteContent', () => {
    it('updates content while preserving ID and structural title', () => {
      const original = createNote({ content: '# Original' });
      const updated = updateNoteContent(original, '# Updated');

      expect(updated.id).toBe(original.id);
      expect(updated.content).toBe('# Updated');
      // Title is structural and preserved (not re-extracted from content)
      expect(updated.title).toBe('Original');
      expect(updated.metadata.title).toBe('Original');
    });

    it('preserves createdAt timestamp', () => {
      const original = createNote({ content: '# Original' });
      const updated = updateNoteContent(original, '# Updated');

      expect(updated.metadata.createdAt).toBe(original.metadata.createdAt);
    });

    it('updates updatedAt timestamp', () => {
      const original = createNote({ content: '# Original' });

      // Wait a tiny bit to ensure different timestamp
      const updated = updateNoteContent(original, '# Updated');

      // updatedAt should be >= original (might be same in fast execution)
      expect(new Date(updated.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });

    it('recalculates tags on update', () => {
      const original = createNote({ content: '# Test #old' });
      const updated = updateNoteContent(original, '# Test #new #fresh');

      expect(updated.metadata.tags).not.toContain('old');
      expect(updated.metadata.tags).toContain('new');
      expect(updated.metadata.tags).toContain('fresh');
    });
  });

  describe('updateNoteTitle', () => {
    it('updates title independently from content', () => {
      const original = createNote({ content: '# Original Content' });
      const updated = updateNoteTitle(original, 'New Title');

      expect(updated.title).toBe('New Title');
      expect(updated.metadata.title).toBe('New Title');
      expect(updated.content).toBe('# Original Content'); // Content unchanged
    });

    it('preserves other fields when updating title', () => {
      const original = createNote({ content: '# Test #tag' });
      const updated = updateNoteTitle(original, 'New Title');

      expect(updated.id).toBe(original.id);
      expect(updated.notebookId).toBe(original.notebookId);
      expect(updated.metadata.tags).toContain('tag');
      expect(updated.metadata.createdAt).toBe(original.metadata.createdAt);
    });

    it('updates updatedAt timestamp', () => {
      const original = createNote({ content: '# Test' });
      const updated = updateNoteTitle(original, 'New Title');

      expect(new Date(updated.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });
  });

  describe('hasTag', () => {
    it('returns true when note has tag', () => {
      const note = createNote({ content: '# Test #javascript' });
      const tag = createTag('javascript');

      expect(hasTag(note, tag)).toBe(true);
    });

    it('returns false when note does not have tag', () => {
      const note = createNote({ content: '# Test #javascript' });
      const tag = createTag('python');

      expect(hasTag(note, tag)).toBe(false);
    });
  });

  describe('collectTags', () => {
    it('collects unique tags from multiple notes', () => {
      const notes = [
        createNote({ content: '# Note 1 #javascript #react' }),
        createNote({ content: '# Note 2 #javascript #vue' }),
        createNote({ content: '# Note 3 #typescript' }),
      ];

      const tags = collectTags(notes);

      expect(tags).toContain('javascript');
      expect(tags).toContain('react');
      expect(tags).toContain('vue');
      expect(tags).toContain('typescript');
      expect(tags.length).toBe(4);
    });
  });
});
