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
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PORT = 29168; // "readied" in phone keypad
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
    // Auth check (constant-time comparison to prevent timing attacks)
    const authHeader = req.headers.authorization;
    const expected = `Bearer ${this.token}`;
    if (
      !authHeader ||
      authHeader.length !== expected.length ||
      !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
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
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}
