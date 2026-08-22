import { extractTitle } from '@dripnex/core';
import type { LocalHttpClient, LocalHttpNote } from './http.js';
import type {
  McpDataStore,
  NoteListRow,
  NoteReadRow,
  NoteSearchRow,
  NotebookRow,
  TagRow,
  TemplateRow,
} from './store.js';

const TEMPLATES_NOTEBOOK_ID = 'templates';

export class HttpStore implements McpDataStore {
  constructor(private readonly client: LocalHttpClient) {}

  async listNotes(input: {
    notebook?: string;
    limit: number;
    includeTrash: boolean;
    status?: string;
  }): Promise<NoteListRow[]> {
    // Local HTTP listNotes is live notes only and has no status field.
    const { notebook, limit } = input;
    const notes = await this.client.listNotes();
    if (!notebook) {
      return notes.slice(0, limit).map(n => ({
        id: n.id,
        title: n.title,
        updated_at: n.updatedAt,
        excerpt: n.excerpt,
      }));
    }

    const book = (await this.client.listBooks()).find(b => b.name === notebook);
    if (!book) return [];

    const matched: NoteListRow[] = [];
    for (const n of notes) {
      const full = await this.client.getNote(n.id);
      if (full?.notebookId !== book.id) continue;
      matched.push({
        id: n.id,
        title: n.title,
        updated_at: n.updatedAt,
        excerpt: n.excerpt,
        notebook_id: full.notebookId,
        notebook_name: book.name,
      });
      if (matched.length >= limit) break;
    }
    return matched;
  }

  async readNote(input: { id?: string; title?: string }): Promise<NoteReadRow | null> {
    if (input.id) {
      const note = await this.client.getNote(input.id);
      return note ? toReadRow(note) : null;
    }
    if (!input.title) return null;
    const hits = await this.client.searchNotes(input.title);
    for (const hit of hits) {
      const note = await this.client.getNote(hit.id);
      if (note) return toReadRow(note);
    }
    return null;
  }

  async searchNotes(query: string, limit: number): Promise<NoteSearchRow[]> {
    const results = await this.client.searchNotes(query);
    return results.slice(0, limit).map(r => ({
      id: r.id,
      title: r.title,
      snippet: r.excerpt,
    }));
  }

  async listNotebooks(): Promise<NotebookRow[]> {
    const books = await this.client.listBooks();
    return books.map(b => ({
      id: b.id,
      name: b.name,
      parent_id: b.parentId,
      icon: b.icon,
    }));
  }

  async listTags(): Promise<TagRow[]> {
    const tags = await this.client.listTags();
    return tags.map(t => ({ name: t.name, color: t.color }));
  }

  async listTemplates(): Promise<TemplateRow[]> {
    const templatesId = await this.templatesNotebookId();
    const notes = await this.client.listNotes();
    const templates: TemplateRow[] = [];
    for (const n of notes) {
      const full = await this.client.getNote(n.id);
      if (!full) continue;
      if (full.notebookId !== templatesId) continue;
      templates.push({ id: full.id, title: full.title, content: full.content });
    }
    return templates.sort((a, b) => a.title.localeCompare(b.title));
  }

  async findTemplate(name: string): Promise<TemplateRow | null> {
    const templatesId = await this.templatesNotebookId();
    const hits = await this.client.searchNotes(name);
    let fuzzy: TemplateRow | null = null;
    for (const hit of hits) {
      const note = await this.client.getNote(hit.id);
      if (!note || note.notebookId !== templatesId) continue;
      const row = { id: note.id, title: note.title, content: note.content };
      if (note.title === name) return row;
      if (!fuzzy && note.title.toLowerCase().includes(name.toLowerCase())) fuzzy = row;
    }
    return fuzzy;
  }

  async findNotebookIdByName(name: string): Promise<string | null> {
    const books = await this.client.listBooks();
    return books.find(b => b.name === name)?.id ?? null;
  }

  async createNote(input: { content: string; notebookId?: string }): Promise<{
    id: string;
    title: string;
  }> {
    const created = await this.client.createNote(input);
    return { id: created.id, title: extractTitle(input.content) };
  }

  async updateNote(id: string, content: string): Promise<{ title: string } | null> {
    const ok = await this.client.updateNote(id, content);
    if (!ok) return null;
    return { title: extractTitle(content) };
  }

  async trashNote(id: string, permanent = false): Promise<boolean> {
    return this.client.deleteNote(id, permanent);
  }

  async status(): Promise<{ status: string; version: string; noteCount: number }> {
    return this.client.getStatus();
  }

  async createNotebook(input: { name: string; parentId?: string }): Promise<{ id: string }> {
    return this.client.createBook(input);
  }

  async updateNotebook(
    id: string,
    patch: { name?: string; icon?: string | null }
  ): Promise<boolean> {
    return this.client.updateBook(id, patch);
  }

  async deleteNotebook(id: string): Promise<boolean> {
    return this.client.deleteBook(id);
  }

  async createTag(input: { name: string; color?: string | null }): Promise<{ name: string }> {
    const created = await this.client.createTag(input);
    return { name: created.name };
  }

  async updateTag(
    name: string,
    patch: { color?: string | null; newName?: string }
  ): Promise<boolean> {
    return this.client.updateTag(name, {
      color: patch.color,
      name: patch.newName,
    });
  }

  async getChanges(since: number): Promise<{
    results: Awaited<ReturnType<LocalHttpClient['getChanges']>>['results'];
    last_seq: number;
  }> {
    return this.client.getChanges(since);
  }

  private async templatesNotebookId(): Promise<string> {
    const books = await this.client.listBooks();
    const found = books.find(
      b => b.id === TEMPLATES_NOTEBOOK_ID || b.name.toLowerCase() === 'templates'
    );
    return found?.id ?? TEMPLATES_NOTEBOOK_ID;
  }
}

function toReadRow(note: LocalHttpNote): NoteReadRow {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    notebook_id: note.notebookId,
  };
}
