/**
 * Export System
 *
 * Export notes as Markdown files + JSON metadata.
 * Follows the format defined in plan.md:
 *
 * export/
 * ├── notes/
 * │   ├── note-1.md
 * │   └── note-2.md
 * ├── metadata.json
 * └── manifest.json
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NoteSnapshot } from '../types/NoteSnapshot.js';

export interface ExportManifest {
  version: 1;
  exportDate: string;
  appVersion: string;
  noteCount: number;
}

export interface ExportMetadata {
  version: 1;
  notes: ExportNoteMetadata[];
}

export interface ExportNoteMetadata {
  id: string;
  filename: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  tags: string[];
  wordCount: number;
}

export interface ExportOptions {
  /** Output directory */
  outputDir: string;
  /** App version for manifest */
  appVersion: string;
  /** Include archived notes */
  includeArchived?: boolean;
}

export interface ExportResult {
  success: boolean;
  path?: string;
  noteCount?: number;
  error?: string;
}

/**
 * Generate a safe filename from note title.
 */
function safeFilename(title: string, id: string): string {
  // Sanitize title: remove special chars, limit length
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  // Use ID suffix to ensure uniqueness
  const shortId = id.substring(0, 8);

  return sanitized ? `${sanitized}-${shortId}.md` : `note-${shortId}.md`;
}

/**
 * Build YAML frontmatter string for a note.
 * Skips if content already starts with `---` to avoid double frontmatter.
 */
function prependFrontmatter(note: NoteSnapshot): string {
  // Don't add frontmatter if content already has it
  if (note.content.trimStart().startsWith('---')) {
    return note.content;
  }

  const escapedTitle = note.title.replace(/"/g, '\\"');
  const tagsYaml = note.tags.length > 0 ? `tags: [${note.tags.join(', ')}]` : 'tags: []';

  const frontmatter = [
    '---',
    `id: "${note.id}"`,
    `title: "${escapedTitle}"`,
    `created: ${note.createdAt}`,
    `updated: ${note.updatedAt}`,
    tagsYaml,
    '---',
    '',
  ].join('\n');

  return frontmatter + note.content;
}

/**
 * Export notes to Markdown + JSON format.
 */
export function exportNotes(notes: NoteSnapshot[], options: ExportOptions): ExportResult {
  const { outputDir, appVersion, includeArchived = false } = options;

  try {
    // Filter notes if needed
    const notesToExport = includeArchived ? notes : notes.filter(n => n.archivedAt === null);

    // Create directory structure
    const notesDir = join(outputDir, 'notes');
    mkdirSync(notesDir, { recursive: true });

    // Track metadata
    const notesMetadata: ExportNoteMetadata[] = [];
    const usedFilenames = new Set<string>();

    // Export each note
    for (const note of notesToExport) {
      let filename = safeFilename(note.title, note.id);

      // Ensure unique filename
      let counter = 1;
      while (usedFilenames.has(filename)) {
        const base = filename.replace('.md', '');
        filename = `${base}-${counter}.md`;
        counter++;
      }
      usedFilenames.add(filename);

      // Write markdown file with YAML frontmatter
      const notePath = join(notesDir, filename);
      const contentWithFrontmatter = prependFrontmatter(note);
      writeFileSync(notePath, contentWithFrontmatter, 'utf-8');

      // Track metadata
      notesMetadata.push({
        id: note.id,
        filename,
        title: note.title,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        archivedAt: note.archivedAt,
        tags: note.tags,
        wordCount: note.wordCount,
      });
    }

    // Write metadata.json
    const metadata: ExportMetadata = {
      version: 1,
      notes: notesMetadata,
    };
    writeFileSync(join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    // Write manifest.json
    const manifest: ExportManifest = {
      version: 1,
      exportDate: new Date().toISOString(),
      appVersion,
      noteCount: notesToExport.length,
    };
    writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    return {
      success: true,
      path: outputDir,
      noteCount: notesToExport.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate an export directory structure.
 */
export function validateExportDir(dir: string): boolean {
  if (!existsSync(dir)) return false;

  const hasManifest = existsSync(join(dir, 'manifest.json'));
  const hasMetadata = existsSync(join(dir, 'metadata.json'));
  const hasNotesDir = existsSync(join(dir, 'notes'));

  return hasManifest && hasMetadata && hasNotesDir;
}

/**
 * Read export manifest.
 */
export function readExportManifest(dir: string): ExportManifest | null {
  try {
    const content = readFileSync(join(dir, 'manifest.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Read export metadata.
 */
export function readExportMetadata(dir: string): ExportMetadata | null {
  try {
    const content = readFileSync(join(dir, 'metadata.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
