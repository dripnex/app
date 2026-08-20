/**
 * Import System
 *
 * Import notes from:
 * - Dripnex export (Markdown + JSON)
 * - Obsidian vault
 * - Plain Markdown folder
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { extractTags as extractContentTags } from '@dripnex/core';
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
  id?: string;
  notebookId?: string;
  isPinned?: boolean;
  isDeleted?: boolean;
  status?: string;
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
  type?: 'dripnex' | 'obsidian' | 'markdown';
  /** Include files in subdirectories */
  recursive?: boolean;
}

/**
 * Detect import source type.
 */
export function detectImportType(dir: string): 'dripnex' | 'obsidian' | 'markdown' {
  // Check for Dripnex export
  if (validateExportDir(dir)) {
    return 'dripnex';
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
    case 'dripnex':
      return importFromDripnexExport(sourceDir);
    case 'obsidian':
      return importFromObsidian(sourceDir, recursive);
    case 'markdown':
      return importFromMarkdownFolder(sourceDir, recursive);
    default:
      return { success: false, error: `Unknown import type: ${type}` };
  }
}

/**
 * Import from Dripnex export format.
 */
function importFromDripnexExport(dir: string): ImportResult {
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
        id: noteMeta.id,
        notebookId: noteMeta.notebookId,
        isPinned: noteMeta.isPinned,
        isDeleted: noteMeta.isDeleted,
        status: noteMeta.status,
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
          originalMetadata: parsed.frontmatter ?? undefined,
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
        const title = parsed.frontmatter?.title
          ? String(parsed.frontmatter.title)
          : filenameToTitle(filename);
        const created = parsed.frontmatter?.created
          ? String(parsed.frontmatter.created)
          : stats.birthtime.toISOString();
        const updated = parsed.frontmatter?.updated
          ? String(parsed.frontmatter.updated)
          : stats.mtime.toISOString();

        notes.push({
          filename,
          content: parsed.content,
          title,
          tags: extractTags(parsed.frontmatter, parsed.content),
          createdAt: created,
          updatedAt: updated,
          originalMetadata: parsed.frontmatter ?? undefined,
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
function findMarkdownFiles(dir: string, recursive: boolean, excludeDirs: string[] = []): string[] {
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

  if (!match || !match[1] || !match[2]) {
    return { frontmatter: null, content };
  }

  try {
    // Simple YAML parsing (key: value pairs only)
    const yamlContent = match[1];
    const bodyContent = match[2];
    const frontmatter: Record<string, unknown> = {};

    for (const line of yamlContent.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value: unknown = line.substring(colonIndex + 1).trim();

        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          value = splitYamlList(value.slice(1, -1));
        } else if (typeof value === 'string') {
          value = unquoteYaml(value);
        }

        frontmatter[key] = value;
      }
    }

    return { frontmatter, content: bodyContent };
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
  const createdAt = parsed.frontmatter?.created ? String(parsed.frontmatter.created) : null;
  const updatedAt = parsed.frontmatter?.updated ? String(parsed.frontmatter.updated) : null;

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
function extractTags(frontmatter: Record<string, unknown> | null, content: string): string[] {
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

  for (const tag of extractContentTags(content)) {
    tags.add(tag.replace(/\//g, '-'));
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
function unquoteYaml(raw: string): string | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return raw;
}

function splitYamlList(inner: string): string[] {
  const items: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === '"' && inner[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      const trimmed = current.trim();
      if (trimmed) items.push(String(unquoteYaml(trimmed)));
      current = '';
      continue;
    }
    current += ch;
  }
  const trimmed = current.trim();
  if (trimmed) items.push(String(unquoteYaml(trimmed)));
  return items;
}

function filenameToTitle(filename: string): string {
  return basename(filename, extname(filename)).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}
