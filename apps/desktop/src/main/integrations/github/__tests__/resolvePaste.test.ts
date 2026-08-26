import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GITHUB_CONNECT_REQUIRED } from '../../../../shared/githubBlob.js';
import { createGitHubService } from '../service.js';

const memory = vi.hoisted(() => ({ keys: new Map<string, string>() }));

vi.mock('../../../services/aiKeyStorage.js', () => ({
  AiKeyStorage: class {
    async getKey(provider: string) {
      return memory.keys.get(provider) ?? null;
    }
    async saveKey(provider: string, apiKey: string) {
      memory.keys.set(provider, apiKey);
    }
    async removeKey(provider: string) {
      memory.keys.delete(provider);
    }
  },
}));

const TOKEN = 'ghp_secret_token_never_in_renderer';
const BLOB = 'https://github.com/acme/private/blob/main/src/a.ts#L2-L3';
const FILE = 'line1\nline2\nline3\nline4\n';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

function headerAuth(init?: RequestInit): string | null {
  const headers = init?.headers;
  if (!headers || typeof headers !== 'object' || headers instanceof Headers) {
    if (headers instanceof Headers) return headers.get('Authorization');
    return null;
  }
  const record = headers as Record<string, string>;
  return record.Authorization ?? record.authorization ?? null;
}

describe('GitHub resolvePaste / status token boundary', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: ReturnType<typeof createGitHubService>;

  beforeEach(() => {
    memory.keys.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    service = createGitHubService('/tmp/dripnex-gh-test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('status() returns login, never the stored token', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ login: 'tomas', name: 'Tomás' }));
    await service.connect(TOKEN);

    const status = await service.status();
    expect(status).toEqual({ connected: true, login: 'tomas', via: 'token' });
    expect(status).not.toHaveProperty('token');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
    expect(Object.keys(status).sort()).toEqual(['connected', 'login', 'via']);
  });

  it('embeds a private blob using the main-process token', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/user')) return jsonResponse({ login: 'tomas', name: null });
      if (url.includes('/contents/src/a.ts')) {
        expect(headerAuth(init)).toBe(`Bearer ${TOKEN}`);
        return textResponse(FILE);
      }
      return jsonResponse({}, 404);
    });
    await service.connect(TOKEN);

    const result = await service.resolvePaste(BLOB);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.kind).toBe('embed');
    expect(result.markdown).toContain('line2');
    expect(result.markdown).toContain('line3');
    expect(result.markdown).not.toContain('line1');
    expect(result.markdown).not.toContain('line4');
    expect(result.markdown).toContain(BLOB);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it('asks to connect when a private blob 404s without a token', async () => {
    fetchMock.mockImplementation(async () => textResponse('', 404));
    const result = await service.resolvePaste(BLOB);
    expect(result).toEqual({
      success: false,
      error: GITHUB_CONNECT_REQUIRED,
      connectRequired: true,
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it('embeds a public blob without a stored token', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      expect(headerAuth(init)).toBeNull();
      expect(String(input)).toContain('/contents/src/a.ts');
      return textResponse(FILE);
    });
    const result = await service.resolvePaste(BLOB);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.markdown).toContain('line2');
    expect(result.markdown).toContain('```ts title=src/a.ts startLine=2 {2-3}');
  });

  it('turns a public issue URL into a titled link', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ title: 'Fix the sync retry' }));
    const result = await service.resolvePaste('https://github.com/acme/app/issues/12');
    expect(result).toEqual({
      success: true,
      kind: 'link',
      markdown: '[Fix the sync retry](https://github.com/acme/app/issues/12)',
    });
  });
});
