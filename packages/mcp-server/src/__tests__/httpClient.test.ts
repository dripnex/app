import { describe, expect, it, vi } from 'vitest';
import { LocalHttpClient, LocalHttpError } from '../http';

const BASE = 'http://127.0.0.1:29168';
const TOKEN = 'placeholder-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(
  fetchFn: (input: URL, init?: RequestInit) => Promise<Response>
): LocalHttpClient {
  return new LocalHttpClient({ baseUrl: BASE, token: TOKEN }, fetchFn);
}

describe('LocalHttpClient', () => {
  it('sends a Bearer token on GET /api/status', async () => {
    const fetchFn = vi.fn(async (input: URL, init?: RequestInit) => {
      expect(input.href).toBe(`${BASE}/api/status`);
      expect(init?.method).toBe('GET');
      expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
      return jsonResponse(200, { status: 'ok', version: '0.16.0', noteCount: 3 });
    });

    const status = await clientWith(fetchFn).getStatus();
    expect(status).toEqual({ status: 'ok', version: '0.16.0', noteCount: 3 });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('lists notes and books', async () => {
    const fetchFn = vi.fn(async (input: URL) => {
      if (input.pathname === '/api/notes') {
        return jsonResponse(200, [
          { id: 'n1', title: 'Hello', excerpt: 'Hi', updatedAt: '2026-01-01T00:00:00.000Z' },
        ]);
      }
      if (input.pathname === '/api/books') {
        return jsonResponse(200, [{ id: 'inbox', name: 'Inbox', parentId: null, icon: null }]);
      }
      throw new Error(`unexpected ${input.pathname}`);
    });

    const http = clientWith(fetchFn);
    await expect(http.listNotes()).resolves.toEqual([
      { id: 'n1', title: 'Hello', excerpt: 'Hi', updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    await expect(http.listBooks()).resolves.toEqual([
      { id: 'inbox', name: 'Inbox', parentId: null, icon: null },
    ]);
  });

  it('reads a note and returns null on 404', async () => {
    const fetchFn = vi.fn(async (input: URL) => {
      if (input.pathname === '/api/notes/missing') {
        return jsonResponse(404, { error: 'Note not found' });
      }
      return jsonResponse(200, {
        id: 'n1',
        title: 'Hello',
        content: '# Hello',
        notebookId: 'inbox',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        tags: ['ship'],
        wordCount: 1,
        isPinned: false,
      });
    });

    const http = clientWith(fetchFn);
    await expect(http.getNote('n1')).resolves.toMatchObject({ id: 'n1', title: 'Hello' });
    await expect(http.getNote('missing')).resolves.toBeNull();
  });

  it('POSTs a note and PUTs content', async () => {
    const fetchFn = vi.fn(async (input: URL, init?: RequestInit) => {
      if (init?.method === 'POST' && input.pathname === '/api/notes') {
        expect(init.headers).toMatchObject({
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({ content: '# New', notebookId: 'inbox' });
        return jsonResponse(201, { id: 'n2' });
      }
      if (init?.method === 'PUT' && input.pathname === '/api/notes/n2') {
        expect(JSON.parse(String(init.body))).toEqual({ content: '# Updated' });
        return jsonResponse(200, { ok: true });
      }
      throw new Error(`unexpected ${init?.method} ${input.pathname}`);
    });

    const http = clientWith(fetchFn);
    await expect(http.createNote({ content: '# New', notebookId: 'inbox' })).resolves.toEqual({
      id: 'n2',
    });
    await expect(http.updateNote('n2', '# Updated')).resolves.toBe(true);
  });

  it('searches with ?q= and deletes with optional permanent=1', async () => {
    const fetchFn = vi.fn(async (input: URL, init?: RequestInit) => {
      if (input.pathname === '/api/notes/search') {
        expect(input.searchParams.get('q')).toBe('hello world');
        return jsonResponse(200, [
          {
            id: 'n1',
            title: 'Hello',
            excerpt: 'hello world',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
      }
      if (init?.method === 'DELETE' && input.pathname === '/api/notes/n1') {
        expect(input.searchParams.get('permanent')).toBeNull();
        return jsonResponse(200, { ok: true });
      }
      if (init?.method === 'DELETE' && input.pathname === '/api/notes/n2') {
        expect(input.searchParams.get('permanent')).toBe('1');
        return jsonResponse(200, { ok: true });
      }
      throw new Error(`unexpected ${init?.method} ${input.href}`);
    });

    const http = clientWith(fetchFn);
    await expect(http.searchNotes('hello world')).resolves.toHaveLength(1);
    await expect(http.deleteNote('n1')).resolves.toBe(true);
    await expect(http.deleteNote('n2', true)).resolves.toBe(true);
  });

  it('creates, updates, and deletes books', async () => {
    const fetchFn = vi.fn(async (input: URL, init?: RequestInit) => {
      if (init?.method === 'POST' && input.pathname === '/api/books') {
        expect(JSON.parse(String(init.body))).toEqual({ name: 'Work', parentId: 'inbox' });
        return jsonResponse(201, { id: 'work' });
      }
      if (init?.method === 'PUT' && input.pathname === '/api/books/work') {
        expect(JSON.parse(String(init.body))).toEqual({ name: 'Office', icon: '📁' });
        return jsonResponse(200, { ok: true });
      }
      if (init?.method === 'DELETE' && input.pathname === '/api/books/work') {
        return jsonResponse(200, { ok: true });
      }
      throw new Error(`unexpected ${init?.method} ${input.pathname}`);
    });

    const http = clientWith(fetchFn);
    await expect(http.createBook({ name: 'Work', parentId: 'inbox' })).resolves.toEqual({
      id: 'work',
    });
    await expect(http.updateBook('work', { name: 'Office', icon: '📁' })).resolves.toBe(true);
    await expect(http.deleteBook('work')).resolves.toBe(true);
  });

  it('creates and updates tags, encoding the name in the path', async () => {
    const fetchFn = vi.fn(async (input: URL, init?: RequestInit) => {
      if (init?.method === 'POST' && input.pathname === '/api/tags') {
        expect(JSON.parse(String(init.body))).toEqual({ name: 'Ship', color: '#fff' });
        return jsonResponse(201, { ok: true, name: 'ship' });
      }
      if (init?.method === 'PUT' && decodeURIComponent(input.pathname) === '/api/tags/ship it') {
        expect(JSON.parse(String(init.body))).toEqual({ name: 'shipped', color: null });
        return jsonResponse(200, { ok: true });
      }
      throw new Error(`unexpected ${init?.method} ${input.pathname}`);
    });

    const http = clientWith(fetchFn);
    await expect(http.createTag({ name: 'Ship', color: '#fff' })).resolves.toEqual({
      ok: true,
      name: 'ship',
    });
    await expect(http.updateTag('ship it', { name: 'shipped', color: null })).resolves.toBe(true);
  });

  it('polls /api/_changes?since=', async () => {
    const fetchFn = vi.fn(async (input: URL) => {
      expect(input.pathname).toBe('/api/_changes');
      expect(input.searchParams.get('since')).toBe('4');
      return jsonResponse(200, {
        results: [{ seq: 5, id: 'n1', kind: 'note', deleted: true }],
        last_seq: 5,
      });
    });

    await expect(clientWith(fetchFn).getChanges(4)).resolves.toEqual({
      results: [{ seq: 5, id: 'n1', kind: 'note', deleted: true }],
      last_seq: 5,
    });
  });

  it('maps 401 to LocalHttpError without leaking the token', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(401, { error: 'Unauthorized' }));
    const err = await clientWith(fetchFn)
      .getStatus()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LocalHttpError);
    expect(err).toMatchObject({ status: 401, message: 'Unauthorized' });
    expect(String((err as Error).message)).not.toContain(TOKEN);
  });

  it('surfaces a reachability error when fetch throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const err = await clientWith(fetchFn)
      .listNotes()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LocalHttpError);
    expect(String((err as Error).message)).toContain('Could not reach Dripnex Local HTTP');
    expect(String((err as Error).message)).toContain(BASE);
    expect(String((err as Error).message)).not.toContain(TOKEN);
  });
});
