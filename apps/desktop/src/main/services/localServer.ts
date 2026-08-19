/**
 * Local HTTP API Server
 *
 * Runs inside the Electron main process, allowing external tools
 * (Alfred, Raycast, Shortcuts, curl) to interact with notes via HTTP.
 *
 * Uses Node.js built-in `http` module — no additional dependencies.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomBytes, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface LocalServerHandlers {
  listNotes: () => Promise<
    Array<{ id: string; title: string; excerpt: string; updatedAt: string }>
  >;
  getNote: (id: string) => Promise<{
    id: string;
    title: string;
    content: string;
    notebookId: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    wordCount: number;
    taskCount?: number;
    checkedTaskCount?: number;
    isPinned: boolean;
  } | null>;
  createNote: (input: {
    content: string;
    notebookId?: string;
  }) => Promise<{ ok: boolean; data?: { id: string }; error?: unknown }>;
  updateNote: (id: string, content: string) => Promise<{ ok: boolean; error?: unknown }>;
  searchNotes: (
    query: string
  ) => Promise<Array<{ id: string; title: string; excerpt: string; updatedAt: string }>>;
  getNoteCount: () => Promise<number>;
  getAppVersion: () => string;
  listNotebooks: () => Promise<
    Array<{ id: string; name: string; parentId: string | null; icon: string | null }>
  >;
  listTags: () => Promise<Array<{ name: string; color: string | null }>>;
  deleteNote: (id: string, permanent?: boolean) => Promise<{ ok: boolean; error?: unknown }>;
  createNotebook: (input: {
    name: string;
    parentId?: string | null;
  }) => Promise<{ ok: boolean; data?: { id: string }; error?: unknown }>;
  updateNotebook: (
    id: string,
    patch: { name?: string; icon?: string | null }
  ) => Promise<{ ok: boolean; error?: unknown }>;
  deleteNotebook: (id: string) => Promise<{ ok: boolean; error?: unknown }>;
  putTag: (
    name: string,
    patch: { color?: string | null; newName?: string }
  ) => Promise<{ ok: boolean; error?: unknown }>;
  getChanges: (since: number) => { results: ChangeRecord[]; last_seq: number };
}

export interface ChangeRecord {
  seq: number;
  id: string;
  kind: 'note' | 'book' | 'tag';
  deleted?: boolean;
}

export class ChangeLog {
  private seq = 0;
  private readonly items: ChangeRecord[] = [];
  private persistPath: string | null = null;
  private persistChain = Promise.resolve();

  attach(persistPath: string): void {
    this.persistPath = persistPath;
  }

  async load(): Promise<void> {
    if (!this.persistPath) return;
    try {
      const raw = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(raw) as { seq?: unknown; items?: unknown };
      if (typeof parsed.seq !== 'number' || !Array.isArray(parsed.items)) return;
      const items: ChangeRecord[] = [];
      for (const item of parsed.items) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Partial<ChangeRecord>;
        if (typeof rec.seq !== 'number' || typeof rec.id !== 'string') continue;
        if (rec.kind !== 'note' && rec.kind !== 'book' && rec.kind !== 'tag') continue;
        items.push({
          seq: rec.seq,
          id: rec.id,
          kind: rec.kind,
          deleted: rec.deleted === true ? true : undefined,
        });
      }
      this.seq = parsed.seq;
      this.items.splice(0, this.items.length, ...items.slice(-500));
    } catch {
      // missing or corrupt — start empty
    }
  }

  record(kind: ChangeRecord['kind'], id: string, deleted = false): ChangeRecord {
    this.seq += 1;
    const rec: ChangeRecord = { seq: this.seq, id, kind, deleted: deleted || undefined };
    this.items.push(rec);
    if (this.items.length > 500) this.items.shift();
    this.schedulePersist();
    return rec;
  }

  since(n: number): { results: ChangeRecord[]; last_seq: number } {
    return {
      results: this.items.filter(item => item.seq > n),
      last_seq: this.seq,
    };
  }

  async flush(): Promise<void> {
    await this.persistChain;
  }

  private schedulePersist(): void {
    if (!this.persistPath) return;
    const path = this.persistPath;
    const payload = JSON.stringify({ seq: this.seq, items: this.items });
    this.persistChain = this.persistChain
      .then(() => fs.writeFile(path, payload, { encoding: 'utf-8', mode: 0o600 }))
      .catch(() => {});
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PORT = 29168; // "dripnex" in phone keypad
const TOKEN_FILE = 'api-token.txt';

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get or create an API bearer token. Stored as plaintext in the app's
 * data directory (not user-facing secrets — local-only convenience token).
 */
export async function getOrCreateApiToken(dataDir: string): Promise<string> {
  const tokenPath = join(dataDir, TOKEN_FILE);
  try {
    const existing = await fs.readFile(tokenPath, 'utf-8');
    const trimmed = existing.trim();
    if (trimmed.length >= 32) return trimmed;
  } catch {
    // File doesn't exist — generate a new token
  }
  const token = randomBytes(32).toString('hex');
  await fs.writeFile(tokenPath, token, { encoding: 'utf-8', mode: 0o600 });
  return token;
}

// ============================================================================
// LocalServer Class
// ============================================================================

export class LocalServer {
  private server: ReturnType<typeof createServer> | null = null;
  private port = DEFAULT_PORT;
  private token = '';

  /**
   * Start the HTTP API server.
   */
  async start(
    port: number = DEFAULT_PORT,
    token: string,
    handlers: LocalServerHandlers
  ): Promise<void> {
    if (this.server) return; // Already running

    this.port = port;
    this.token = token;

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res, handlers);
    });

    return new Promise((resolve, reject) => {
      this.server!.on('error', err => {
        this.server = null;
        reject(err);
      });
      this.server!.listen(port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP API server.
   */
  stop(): Promise<void> {
    return new Promise(resolve => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.port;
  }

  // --------------------------------------------------------------------------
  // Request Handling
  // --------------------------------------------------------------------------

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    handlers: LocalServerHandlers
  ): Promise<void> {
    // Auth check (constant-time comparison to prevent timing attacks).
    // Compare BYTE lengths, not JS string lengths: a multibyte Authorization
    // header can share the same UTF-16 length as `expected` while producing a
    // different-length Buffer, which makes timingSafeEqual throw a RangeError
    // (unhandled here → hung socket). Buffer.length is the byte length, so the
    // guard below guarantees timingSafeEqual only sees equal-length buffers.
    const authHeader = req.headers.authorization ?? '';
    const authBuf = Buffer.from(authHeader);
    const expectedBuf = Buffer.from(`Bearer ${this.token}`);
    if (authBuf.length !== expectedBuf.length || !timingSafeEqual(authBuf, expectedBuf)) {
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const method = req.method?.toUpperCase() || 'GET';
    const pathname = url.pathname;

    try {
      // GET /api/status
      if (method === 'GET' && pathname === '/api/status') {
        const noteCount = await handlers.getNoteCount();
        this.sendJson(res, 200, {
          status: 'ok',
          version: handlers.getAppVersion(),
          noteCount,
        });
        return;
      }

      // GET /api/notes/search?q=query
      if (method === 'GET' && pathname === '/api/notes/search') {
        const query = url.searchParams.get('q') || '';
        if (!query) {
          this.sendJson(res, 400, { error: 'Missing ?q= parameter' });
          return;
        }
        const results = await handlers.searchNotes(query);
        this.sendJson(res, 200, results);
        return;
      }

      // POST /api/notes/quick (must be checked before :id route)
      if (method === 'POST' && pathname === '/api/notes/quick') {
        const body = await this.readBody(req);
        const { content } = body as { content?: string };
        if (typeof content !== 'string') {
          this.sendJson(res, 400, { error: 'Missing content' });
          return;
        }
        const result = await handlers.createNote({ content, notebookId: 'inbox' });
        if (result.ok && result.data) {
          this.sendJson(res, 201, { id: result.data.id });
        } else {
          this.sendJson(res, 500, { error: 'Failed to create note' });
        }
        return;
      }

      // GET /api/notes/:id
      if (method === 'GET' && pathname.match(/^\/api\/notes\/[^/]+$/)) {
        const noteId = pathname.split('/').pop()!;
        const note = await handlers.getNote(noteId);
        if (!note) {
          this.sendJson(res, 404, { error: 'Note not found' });
          return;
        }
        this.sendJson(res, 200, note);
        return;
      }

      // PUT /api/notes/:id
      if (method === 'PUT' && pathname.match(/^\/api\/notes\/[^/]+$/)) {
        const noteId = pathname.split('/').pop()!;
        const body = await this.readBody(req);
        const { content } = body as { content?: string };
        if (typeof content !== 'string') {
          this.sendJson(res, 400, { error: 'Missing content' });
          return;
        }
        const result = await handlers.updateNote(noteId, content);
        if (result.ok) {
          this.sendJson(res, 200, { ok: true });
        } else {
          this.sendJson(res, 500, { error: 'Failed to update note' });
        }
        return;
      }

      // POST /api/notes
      if (method === 'POST' && pathname === '/api/notes') {
        const body = await this.readBody(req);
        const { content, notebookId } = body as {
          content?: string;
          notebookId?: string;
        };
        if (typeof content !== 'string') {
          this.sendJson(res, 400, { error: 'Missing content' });
          return;
        }
        const result = await handlers.createNote({ content, notebookId });
        if (result.ok && result.data) {
          this.sendJson(res, 201, { id: result.data.id });
        } else {
          this.sendJson(res, 500, { error: 'Failed to create note' });
        }
        return;
      }

      // GET /api/notes
      if (method === 'GET' && pathname === '/api/notes') {
        const notes = await handlers.listNotes();
        this.sendJson(res, 200, notes);
        return;
      }

      if (method === 'GET' && pathname === '/api/books') {
        const books = await handlers.listNotebooks();
        this.sendJson(res, 200, books);
        return;
      }

      if (method === 'GET' && pathname === '/api/tags') {
        const tags = await handlers.listTags();
        this.sendJson(res, 200, tags);
        return;
      }

      if (method === 'DELETE' && pathname.match(/^\/api\/notes\/[^/]+$/)) {
        const noteId = pathname.split('/').pop()!;
        const permanent = url.searchParams.get('permanent') === '1';
        const result = await handlers.deleteNote(noteId, permanent);
        if (result.ok) {
          this.sendJson(res, 200, { ok: true });
        } else {
          this.sendJson(res, 404, { error: 'Note not found' });
        }
        return;
      }

      if (method === 'PUT' && pathname.match(/^\/api\/books\/[^/]+$/)) {
        const bookId = pathname.split('/').pop()!;
        const body = await this.readBody(req);
        const patch: { name?: string; icon?: string | null } = {};
        if (typeof body.name === 'string') patch.name = body.name;
        if (body.icon === null || typeof body.icon === 'string') patch.icon = body.icon;
        if (patch.name === undefined && patch.icon === undefined) {
          this.sendJson(res, 400, { error: 'Missing name or icon' });
          return;
        }
        const result = await handlers.updateNotebook(bookId, patch);
        if (result.ok) {
          this.sendJson(res, 200, { ok: true });
        } else {
          this.sendJson(res, 404, { error: 'Notebook not found' });
        }
        return;
      }

      if (method === 'POST' && pathname === '/api/tags') {
        const body = await this.readBody(req);
        const name = typeof body.name === 'string' ? body.name : '';
        if (!name.trim()) {
          this.sendJson(res, 400, { error: 'Missing name' });
          return;
        }
        const color =
          body.color === null || typeof body.color === 'string' ? body.color : undefined;
        const result = await handlers.putTag(name, { color });
        if (result.ok) {
          this.sendJson(res, 201, { ok: true, name: name.trim().toLowerCase() });
        } else {
          this.sendJson(res, 500, { error: 'Failed to save tag' });
        }
        return;
      }

      if (method === 'PUT' && pathname.match(/^\/api\/tags\/[^/]+$/)) {
        const tagName = decodeURIComponent(pathname.split('/').pop()!);
        const body = await this.readBody(req);
        const patch: { color?: string | null; newName?: string } = {};
        if (body.color === null || typeof body.color === 'string') patch.color = body.color;
        if (typeof body.name === 'string') patch.newName = body.name;
        if (patch.color === undefined && patch.newName === undefined) {
          this.sendJson(res, 400, { error: 'Missing color or name' });
          return;
        }
        const result = await handlers.putTag(tagName, patch);
        if (result.ok) {
          this.sendJson(res, 200, { ok: true });
        } else {
          this.sendJson(res, 404, { error: 'Tag not found' });
        }
        return;
      }

      if (method === 'POST' && pathname === '/api/books') {
        const body = await this.readBody(req);
        const name = typeof body.name === 'string' ? body.name : '';
        if (!name.trim()) {
          this.sendJson(res, 400, { error: 'Missing name' });
          return;
        }
        const parentId = typeof body.parentId === 'string' ? body.parentId : undefined;
        const result = await handlers.createNotebook({ name, parentId });
        if (result.ok && result.data) {
          this.sendJson(res, 201, { id: result.data.id });
        } else {
          this.sendJson(res, 500, { error: 'Failed to create notebook' });
        }
        return;
      }

      if (method === 'DELETE' && pathname.match(/^\/api\/books\/[^/]+$/)) {
        const bookId = pathname.split('/').pop()!;
        const result = await handlers.deleteNotebook(bookId);
        if (result.ok) {
          this.sendJson(res, 200, { ok: true });
        } else {
          this.sendJson(res, 404, { error: 'Notebook not found' });
        }
        return;
      }

      if (method === 'GET' && (pathname === '/api/_changes' || pathname === '/_changes')) {
        const since = Number(url.searchParams.get('since') ?? '0');
        this.sendJson(res, 200, handlers.getChanges(Number.isFinite(since) ? since : 0));
        return;
      }

      // 404 for everything else
      this.sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      this.sendJson(res, 500, { error: message });
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5 MB

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error('Request body too large (max 5MB)'));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
        } catch (err) {
          reject(new Error('Invalid JSON body', { cause: err }));
        }
      });
      req.on('error', reject);
    });
  }
}
