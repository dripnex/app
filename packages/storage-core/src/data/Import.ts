/**
 * Import System
 *
 * Import notes from:
 * - Readied export (Markdown + JSON)
 * - Obsidian vault
 * - Plain Markdown folder
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { validateExportDir, readExportMetadata } from './Export.js';

export interface ImportedNote {
  /** Original filename */
  filename: string;
  /** Note content (raw markdown) */
  content: string;
  /** Title (from frontmatter or filename) */
  title: string;
  /** Tags (from frontmatter or body) */
  tags: string[];
  /** Created date (from frontmatter or file stats) */
  createdAt: string;
  /** Updated date (from frontmatter or file stats) */
  updatedAt: string;
  /** Original metadata (for reference) */
  originalMetadata?: Record<string, unknown>;
}

export interface ImportResult {
  success: boolean;
  notes?: ImportedNote[];
  skipped?: string[];
  error?: string;
}

export interface ImportOptions {
  /** Source directory path */
  sourceDir: string;
  /** Import type (auto-detect if not specified) */
  type?: 'readied' | 'obsidian' | 'markdown';
  /** Include files in subdirectories */
  recursive?: boolean;
}

/**
 * Detect import source type.
 */
export function detectImportType(dir: string): 'readied' | 'obsidian' | 'markdown' {
  // Check for Readied export
  if (validateExportDir(dir)) {
    return 'readied';
  }

  // Check for Obsidian vault (.obsidian folder)
  if (existsSync(join(dir, '.obsidian'))) {
    return 'obsidian';
  }

  // Default to plain markdown
  return 'markdown';
}

/**
 * Import notes from any supported source.
 */
export function importNotes(options: ImportOptions): ImportResult {
  const { sourceDir, recursive = true } = options;

  if (!existsSync(sourceDir)) {
    return { success: false, error: 'Source directory does not exist' };
  }

  const type = options.type ?? detectImportType(sourceDir);

  switch (type) {
    case 'readied':
      return importFromReadiedExport(sourceDir);
    case 'obsidian':
      return importFromObsidian(sourceDir, recursive);
    case 'markdown':
      return importFromMarkdownFolder(sourceDir, recursive);
    default:
      return { success: false, error: `Unknown import type: ${type}` };
  }
}

/**
 * Import from Readied export format.
 */
function importFromReadiedExport(dir: string): ImportResult {
  try {
    const metadata = readExportMetadata(dir);
    if (!metadata) {
      return { success: false, error: 'Invalid export: missing metadata.json' };
    }

    const notes: ImportedNote[] = [];
    const notesDir = join(dir, 'notes');

    for (const noteMeta of metadata.notes) {
      const filePath = join(notesDir, noteMeta.filename);

      if (!existsSync(filePath)) {
        continue;
      }

      const content = readFileSync(filePath, 'utf-8');

      notes.push({
        filename: noteMeta.filename,
        content,
        title: noteMeta.title,
        tags: noteMeta.tags,
        createdAt: noteMeta.createdAt,
        updatedAt: noteMeta.updatedAt,
        originalMetadata: noteMeta as unknown as Record<string, unknown>,
      });
    }

    return { success: true, notes };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Import from Obsidian vault.
 */
function importFromObsidian(dir: string, recursive: boolean): ImportResult {
  try {
    const files = findMarkdownFiles(dir, recursive, ['.obsidian', '.trash']);
    const notes: ImportedNote[] = [];
    const skipped: string[] = [];

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const filename = basename(filePath);
        const stats = statSync(filePath);

        // Parse frontmatter and extract metadata
        const parsed = parseObsidianNote(content, filename);

        // Convert wikilinks to standard markdown links
        const convertedContent = convertWikilinks(parsed.content);

        notes.push({
          filename,
          content: convertedContent,
          title: parsed.title,
          tags: parsed.tags,
          createdAt: parsed.createdAt ?? stats.birthtime.toISOString(),
          updatedAt: parsed.updatedAt ?? stats.mtime.toISOString(),
          originalMetadata: parsed.frontmatter,
        });
      } catch {
        skipped.push(filePath);
      }
    }

    return { success: true, notes, skipped };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Import from plain Markdown folder.
 */
function importFromMarkdownFolder(dir: string, recursive: boolean): ImportResult {
  try {
    const files = findMarkdownFiles(dir, recursive);
    const notes: ImportedNote[] = [];
    const skipped: string[] = [];

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const filename = basename(filePath);
        const stats = statSync(filePath);

        // Parse frontmatter if present
        const parsed = parseFrontmatter(content);
        const title = parsed.frontmatter?.title ?? filenameToTitle(filename);

        notes.push({
          filename,
          content: parsed.content,
          title,
          tags: extractTags(parsed.frontmatter, parsed.content),
          createdAt: parsed.frontmatter?.created ?? stats.birthtime.toISOString(),
          updatedAt: parsed.frontmatter?.updated ?? stats.mtime.toISOString(),
          originalMetadata: parsed.frontmatter,
        });
      } catch {
        skipped.push(filePath);
      }
    }

    return { success: true, notes, skipped };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find all markdown files in a directory.
 */
function findMarkdownFiles(
  dir: string,
  recursive: boolean,
  excludeDirs: string[] = []
): string[] {
  const results: string[] = [];

  function scan(currentDir: string): void {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (recursive && !excludeDirs.includes(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
        results.push(fullPath);
      }
    }
  }

  scan(dir);
  return results;
}

/**
 * Parse YAML frontmatter from markdown content.
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  content: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    return { frontmatter: null, content };
  }

  try {
    // Simple YAML parsing (key: value pairs only)
    const yamlContent = match[1];
    const frontmatter: Record<string, unknown> = {};

    for (const line of yamlContent.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value: unknown = line.substring(colonIndex + 1).trim();

        // Parse arrays [a, b, c]
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map(s => s.trim().replace(/^["']|["']$/g, ''));
        }

        frontmatter[key] = value;
      }
    }

    return { frontmatter, content: match[2] };
  } catch {
    return { frontmatter: null, content };
  }
}

/**
 * Parse Obsidian-specific note format.
 */
function parseObsidianNote(
  content: string,
  filename: string
): {
  title: string;
  tags: string[];
  content: string;
  createdAt: string | null;
  updatedAt: string | null;
  frontmatter: Record<string, unknown> | null;
} {
  const parsed = parseFrontmatter(content);

  // Title: from frontmatter, aliases, or filename
  let title = filenameToTitle(filename);
  if (parsed.frontmatter?.title) {
    title = String(parsed.frontmatter.title);
  } else if (parsed.frontmatter?.aliases && Array.isArray(parsed.frontmatter.aliases)) {
    title = String(parsed.frontmatter.aliases[0]);
  }

  // Tags: from frontmatter and inline #tags
  const tags = extractTags(parsed.frontmatter, parsed.content);

  // Dates from frontmatter
  const createdAt = parsed.frontmatter?.created
    ? String(parsed.frontmatter.created)
    : null;
  const updatedAt = parsed.frontmatter?.updated
    ? String(parsed.frontmatter.updated)
    : null;

  return {
    title,
    tags,
    content: parsed.content,
    createdAt,
    updatedAt,
    frontmatter: parsed.frontmatter,
  };
}

/**
 * Extract tags from frontmatter and inline content.
 */
function extractTags(
  frontmatter: Record<string, unknown> | null,
  content: string
): string[] {
  const tags = new Set<string>();

  // From frontmatter
  if (frontmatter?.tags) {
    const fmTags = Array.isArray(frontmatter.tags)
      ? frontmatter.tags
      : String(frontmatter.tags).split(',');

    for (const tag of fmTags) {
      const cleaned = String(tag).trim().replace(/^#/, '');
      if (cleaned) {
        // Flatten nested tags (parent/child -> parent-child)
        tags.add(cleaned.replace(/\//g, '-'));
      }
    }
  }

  // From inline #tags
  const inlineTags = content.match(/#[a-zA-Z][\w-/]*/g) ?? [];
  for (const tag of inlineTags) {
    const cleaned = tag.replace(/^#/, '').replace(/\//g, '-');
    tags.add(cleaned);
  }

  return Array.from(tags);
}

/**
 * Convert Obsidian wikilinks to standard markdown links.
 * [[note]] -> [note](note)
 * [[note|display]] -> [display](note)
 * [[note#heading]] -> [note#heading](note#heading)
 */
function convertWikilinks(content: string): string {
  // Pattern: [[target|display]] or [[target]]
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, display) => {
    const linkText = display ?? target;
    // Keep the target as-is for internal reference
    return `[${linkText}](${target})`;
  });
}

/**
 * Convert filename to title.
 */
function filenameToTitle(filename: string): string {
  return basename(filename, extname(filename))
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
