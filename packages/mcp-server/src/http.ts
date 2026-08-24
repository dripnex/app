/**
 * Dripnex Local HTTP client.
 *
 * Shapes match apps/desktop/src/main/services/localServer.ts — do not invent routes.
 */

export interface LocalHttpConfig {
  baseUrl: string;
  token: string;
}

export interface LocalHttpStatus {
  status: string;
  version: string;
  noteCount: number;
}

export interface LocalHttpNoteListItem {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
}

export interface LocalHttpNote {
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
}

export interface LocalHttpBook {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
}

export interface LocalHttpTag {
  name: string;
  color: string | null;
}

export interface LocalHttpChangeRecord {
  seq: number;
  id: string;
  kind: 'note' | 'book' | 'tag';
  deleted?: boolean;
}

export interface LocalHttpChanges {
  results: LocalHttpChangeRecord[];
  last_seq: number;
}

export class LocalHttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'LocalHttpError';
    this.status = status;
    this.payload = payload;
  }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function resolveLocalHttpConfig(
  env: NodeJS.ProcessEnv = process.env
): LocalHttpConfig | null {
  const rawUrl = env.DRIPNEX_LOCAL_SERVER_URL?.trim() ?? '';
  const token = env.DRIPNEX_LOCAL_TOKEN?.trim() ?? '';

  if (!rawUrl && !token) return null;
  if (rawUrl && !token) {
    throw new Error(
      'DRIPNEX_LOCAL_SERVER_URL is set but DRIPNEX_LOCAL_TOKEN is missing. Copy the token from Settings → Integrations → Local HTTP.'
    );
  }
  if (token && !rawUrl) {
    throw new Error(
      'DRIPNEX_LOCAL_TOKEN is set but DRIPNEX_LOCAL_SERVER_URL is missing. Example: http://127.0.0.1:29168'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`DRIPNEX_LOCAL_SERVER_URL is not a valid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('DRIPNEX_LOCAL_SERVER_URL must be http or https.');
  }

  if (!LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      'DRIPNEX_LOCAL_SERVER_URL must point at this machine (127.0.0.1 or localhost).'
    );
  }

  return { baseUrl: stripTrailingSlashes(rawUrl), token };
}

/**
 * Strip trailing slashes with a scan rather than a `/+$` regex.
 * The regex backtracks quadratically on a long run of slashes that is not at
 * the end of the string (CodeQL js/polynomial-redos).
 */
function stripTrailingSlashes(value: string): string {
  const SLASH = 47;
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === SLASH) {
    end--;
  }
  return value.slice(0, end);
}

export type FetchLike = (input: URL, init?: RequestInit) => Promise<Response>;

export class LocalHttpClient {
  constructor(
    private readonly config: LocalHttpConfig,
    private readonly fetchFn: FetchLike = fetch
  ) {}

  getStatus(): Promise<LocalHttpStatus> {
    return this.request<LocalHttpStatus>('GET', '/api/status');
  }

  listNotes(): Promise<LocalHttpNoteListItem[]> {
    return this.request<LocalHttpNoteListItem[]>('GET', '/api/notes');
  }

  async getNote(id: string): Promise<LocalHttpNote | null> {
    try {
      return await this.request<LocalHttpNote>('GET', `/api/notes/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof LocalHttpError && err.status === 404) return null;
      throw err;
    }
  }

  createNote(input: { content: string; notebookId?: string }): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/api/notes', { body: input });
  }

  async updateNote(id: string, content: string): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('PUT', `/api/notes/${encodeURIComponent(id)}`, {
        body: { content },
      });
      return true;
    } catch (err) {
      if (err instanceof LocalHttpError && err.status === 404) return false;
      throw err;
    }
  }

  searchNotes(query: string): Promise<LocalHttpNoteListItem[]> {
    return this.request<LocalHttpNoteListItem[]>('GET', '/api/notes/search', {
      query: { q: query },
    });
  }

  async deleteNote(id: string, permanent = false): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('DELETE', `/api/notes/${encodeURIComponent(id)}`, {
        query: permanent ? { permanent: '1' } : undefined,
      });
      return true;
    } catch (err) {
      if (err instanceof LocalHttpError && err.status === 404) return false;
      throw err;
    }
  }

  listBooks(): Promise<LocalHttpBook[]> {
    return this.request<LocalHttpBook[]>('GET', '/api/books');
  }

  createBook(input: { name: string; parentId?: string }): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/api/books', { body: input });
  }

  async updateBook(id: string, patch: { name?: string; icon?: string | null }): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('PUT', `/api/books/${encodeURIComponent(id)}`, {
        body: patch,
      });
      return true;
    } catch (err) {
      if (err instanceof LocalHttpError && err.status === 404) return false;
      throw err;
    }
  }

  async deleteBook(id: string): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('DELETE', `/api/books/${encodeURIComponent(id)}`);
      return true;
    } catch (err) {
      if (err instanceof LocalHttpError && err.status === 404) return false;
      throw err;
    }
  }

  listTags(): Promise<LocalHttpTag[]> {
    return this.request<LocalHttpTag[]>('GET', '/api/tags');
  }

  createTag(input: {
    name: string;
    color?: string | null;
  }): Promise<{ ok: boolean; name: string }> {
    return this.request<{ ok: boolean; name: string }>('POST', '/api/tags', { body: input });
  }

  async updateTag(name: string, patch: { color?: string | null; name?: string }): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('PUT', `/api/tags/${encodeURIComponent(name)}`, {
        body: patch,
      });
      return true;
    } catch (err) {
      if (err instanceof LocalHttpError && err.status === 404) return false;
      throw err;
    }
  }

  getChanges(since: number): Promise<LocalHttpChanges> {
    return this.request<LocalHttpChanges>('GET', '/api/_changes', {
      query: { since: String(since) },
    });
  }

  private async request<T>(
    method: string,
    path: string,
    options: { query?: Record<string, string | undefined>; body?: unknown } = {}
  ): Promise<T> {
    const url = new URL(path, `${this.config.baseUrl}/`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.token}`,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new LocalHttpError(
        `Could not reach Dripnex Local HTTP at ${this.config.baseUrl}. Enable Settings → Integrations → Local HTTP. ${cause}`,
        0,
        err
      );
    }

    const text = await res.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        throw new LocalHttpError(`Local HTTP returned non-JSON (${res.status})`, res.status, text);
      }
    }

    if (!res.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Local HTTP ${res.status}`;
      throw new LocalHttpError(message, res.status, data);
    }

    return data as T;
  }
}
