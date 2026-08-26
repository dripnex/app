import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  formatGithubBlobMarkdown,
  GITHUB_CONNECT_REQUIRED,
  githubMarkdownLink,
  parseGithubPasteUrl,
  sliceFileLines,
  type GithubBlobRef,
  type GithubPasteTarget,
} from '../../../shared/githubBlob.js';
import { AiKeyStorage } from '../../services/aiKeyStorage.js';

const execFileAsync = promisify(execFile);
const PROVIDER = 'github';

export interface GitHubUser {
  login: string;
  name: string | null;
}

export function parseIssueUrl(raw: string): { owner: string; repo: string; number: number } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)(?:#.*)?$/i
  );
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]!, number: Number(match[3]) };
}

export function noteFromIssue(issue: {
  title: string;
  body: string | null;
  html_url: string;
  labels: Array<{ name: string }>;
  state?: string;
}): string {
  const tags = [
    'task',
    'github',
    ...issue.labels.map(label => label.name.replace(/\s+/g, '-').toLowerCase()),
  ];
  const unique = [...new Set(tags)].map(tag => `#${tag}`).join(' ');
  const body = (issue.body ?? '').trim();
  const state = issue.state ? `State: ${issue.state}` : null;
  return [`# ${issue.title}`, '', unique, '', `Source: ${issue.html_url}`, state, '', body]
    .filter(line => line !== null)
    .join('\n');
}

export type WatcherKind = 'issue' | 'repo' | 'search';

export interface WatcherSpec {
  kind: WatcherKind;
  label: string;
  owner?: string;
  repo?: string;
  number?: number;
  query?: string;
}

export interface GitHubWatcher {
  id: string;
  spec: string;
  kind: WatcherKind;
  label: string;
  notebookId: string;
  lastPulledAt: string | null;
  lastError: string | null;
}

export interface GitHubPullResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function parseRepoSpec(raw: string): { owner: string; repo: string } | null {
  const match = raw.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]! };
}

export function parseWatcherSpec(raw: string): WatcherSpec | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const issue = parseIssueUrl(trimmed);
  if (issue) {
    return {
      kind: 'issue',
      label: `${issue.owner}/${issue.repo}#${issue.number}`,
      ...issue,
    };
  }
  const repo = parseRepoSpec(trimmed);
  if (repo) {
    return { kind: 'repo', label: `${repo.owner}/${repo.repo}`, ...repo };
  }
  if (trimmed.length < 3) return null;
  return { kind: 'search', label: trimmed, query: trimmed };
}

async function readGhCliToken(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { timeout: 4000 });
    const token = stdout.trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export class GitHubConnectRequiredError extends Error {
  constructor() {
    super(GITHUB_CONNECT_REQUIRED);
    this.name = 'GitHubConnectRequiredError';
  }
}

const MAX_FILE_BYTES = 512 * 1024;

async function githubFetch(token: string | null, path: string, accept: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Dripnex',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`https://api.github.com${path}`, { headers });
}

function throwIfNotOk(response: Response, hasToken: boolean): void {
  if (response.ok) return;
  if (response.status === 401) throw new Error('GitHub token was rejected.');
  if (response.status === 404) {
    if (!hasToken) throw new GitHubConnectRequiredError();
    throw new Error('Not found, or this token cannot see it.');
  }
  throw new Error(`GitHub returned ${response.status}.`);
}

export async function githubRequest<T>(token: string | null, path: string): Promise<T> {
  const response = await githubFetch(token, path, 'application/vnd.github+json');
  throwIfNotOk(response, Boolean(token));
  return (await response.json()) as T;
}

export async function githubRequestText(token: string | null, path: string): Promise<string> {
  const response = await githubFetch(token, path, 'application/vnd.github.raw');
  throwIfNotOk(response, Boolean(token));
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > MAX_FILE_BYTES) throw new Error('That file is too large to embed.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('That file is too large to embed.');
  return new TextDecoder('utf-8').decode(buffer);
}

export type GitHubPasteResult =
  | { success: true; markdown: string; kind: 'embed' | 'link' }
  | { success: false; error: string; connectRequired?: boolean };

interface WatcherStore {
  watchers: GitHubWatcher[];
  links: Record<string, { noteId: string; updatedAt: string }>;
}

export interface GitHubNoteSink {
  create: (content: string, notebookId: string) => Promise<{ id: string } | null>;
  update: (id: string, content: string) => Promise<boolean>;
  get: (id: string) => Promise<{ id: string; content: string; isDeleted?: boolean } | null>;
}

const WATCHERS_FILE = 'github-watchers.json';
const REPO_PAGE = 30;
const SEARCH_PAGE = 20;

function emptyStore(): WatcherStore {
  return { watchers: [], links: {} };
}

interface GitHubIssuePayload {
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  updated_at: string;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
}

export function createGitHubService(dataDir: string, notes?: GitHubNoteSink) {
  const keys = new AiKeyStorage(dataDir);
  const storePath = join(dataDir, WATCHERS_FILE);

  const readStore = (): WatcherStore => {
    try {
      if (!existsSync(storePath)) return emptyStore();
      const parsed = JSON.parse(readFileSync(storePath, 'utf8')) as WatcherStore;
      return {
        watchers: Array.isArray(parsed.watchers) ? parsed.watchers : [],
        links: parsed.links && typeof parsed.links === 'object' ? parsed.links : {},
      };
    } catch {
      return emptyStore();
    }
  };

  const writeStore = (store: WatcherStore): void => {
    writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
  };

  const requireToken = async (): Promise<string> => {
    const token = await keys.getKey(PROVIDER);
    if (!token) throw new Error('Connect GitHub first.');
    return token;
  };

  const upsertIssue = async (
    issue: GitHubIssuePayload,
    notebookId: string,
    store: WatcherStore
  ): Promise<'created' | 'updated' | 'skipped'> => {
    if (!notes) return 'skipped';
    if (issue.pull_request) return 'skipped';
    const content = noteFromIssue(issue);
    const existing = store.links[issue.html_url];
    if (existing) {
      if (existing.updatedAt === issue.updated_at) return 'skipped';
      const note = await notes.get(existing.noteId);
      if (note && !note.isDeleted) {
        const ok = await notes.update(note.id, content);
        if (!ok) return 'skipped';
        store.links[issue.html_url] = { noteId: note.id, updatedAt: issue.updated_at };
        return 'updated';
      }
    }
    const created = await notes.create(content, notebookId);
    if (!created) return 'skipped';
    store.links[issue.html_url] = { noteId: created.id, updatedAt: issue.updated_at };
    return 'created';
  };

  const issuesForWatcher = async (
    token: string,
    spec: WatcherSpec
  ): Promise<GitHubIssuePayload[]> => {
    if (spec.kind === 'issue' && spec.owner && spec.repo && spec.number) {
      const issue = await githubRequest<GitHubIssuePayload>(
        token,
        `/repos/${spec.owner}/${spec.repo}/issues/${spec.number}`
      );
      return [issue];
    }
    if (spec.kind === 'repo' && spec.owner && spec.repo) {
      const issues = await githubRequest<GitHubIssuePayload[]>(
        token,
        `/repos/${spec.owner}/${spec.repo}/issues?state=open&per_page=${REPO_PAGE}`
      );
      return issues.filter(issue => !issue.pull_request);
    }
    const raw = spec.query ?? spec.label;
    const q = /is:\s*issue/i.test(raw) ? raw : `${raw} is:issue`;
    const result = await githubRequest<{ items: GitHubIssuePayload[] }>(
      token,
      `/search/issues?q=${encodeURIComponent(q)}&per_page=${SEARCH_PAGE}`
    );
    return result.items.filter(issue => !issue.pull_request);
  };

  const contentsPath = (blob: GithubBlobRef): string => {
    const encoded = blob.path
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    return `/repos/${blob.owner}/${blob.repo}/contents/${encoded}?ref=${encodeURIComponent(blob.ref)}`;
  };

  const embedBlob = async (blob: GithubBlobRef): Promise<GitHubPasteResult> => {
    if (blob.startLine == null) {
      const label = `${blob.owner}/${blob.repo}/${blob.path}`;
      return { success: true, kind: 'link', markdown: githubMarkdownLink(label, blob.url) };
    }
    const token = (await keys.getKey(PROVIDER)) || null;
    try {
      const text = await githubRequestText(token, contentsPath(blob));
      const sliced = sliceFileLines(text, blob.startLine, blob.endLine ?? blob.startLine);
      if (!sliced) return { success: false, error: 'Those lines are not in that file.' };
      return {
        success: true,
        kind: 'embed',
        markdown: formatGithubBlobMarkdown(blob, sliced),
      };
    } catch (error) {
      if (error instanceof GitHubConnectRequiredError) {
        return { success: false, error: error.message, connectRequired: true };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not load that file.',
      };
    }
  };

  const titleLink = async (
    target: Exclude<GithubPasteTarget, GithubBlobRef>
  ): Promise<GitHubPasteResult> => {
    const token = (await keys.getKey(PROVIDER)) || null;
    try {
      let title: string | null = null;
      if (target.kind === 'issue') {
        const issue = await githubRequest<{ title: string }>(
          token,
          `/repos/${target.owner}/${target.repo}/issues/${target.number}`
        );
        title = issue.title;
      } else if (target.kind === 'pull') {
        const pull = await githubRequest<{ title: string }>(
          token,
          `/repos/${target.owner}/${target.repo}/pulls/${target.number}`
        );
        title = pull.title;
      } else {
        const commit = await githubRequest<{ commit: { message: string } }>(
          token,
          `/repos/${target.owner}/${target.repo}/commits/${target.sha}`
        );
        title = commit.commit.message.split('\n')[0]?.trim() ?? null;
      }
      if (!title) return { success: false, error: 'Could not load that GitHub page.' };
      return { success: true, kind: 'link', markdown: githubMarkdownLink(title, target.url) };
    } catch {
      return { success: false, error: 'Could not load that GitHub page.' };
    }
  };

  return {
    async status(): Promise<{ connected: boolean; login: string | null; via: 'token' | null }> {
      const token = await keys.getKey(PROVIDER);
      if (!token) return { connected: false, login: null, via: null };
      try {
        const user = await githubRequest<GitHubUser>(token, '/user');
        return { connected: true, login: user.login, via: 'token' };
      } catch {
        return { connected: false, login: null, via: null };
      }
    },

    async connect(pasted?: string | null): Promise<{ login: string }> {
      const token = pasted?.trim() || (await readGhCliToken());
      if (!token) {
        throw new Error(
          'No GitHub session. Run `gh auth login` in a terminal, or paste a classic token with repo scope.'
        );
      }
      const user = await githubRequest<GitHubUser>(token, '/user');
      await keys.saveKey(PROVIDER, token);
      return { login: user.login };
    },

    async disconnect(): Promise<void> {
      await keys.removeKey(PROVIDER);
    },

    async resolvePaste(url: string): Promise<GitHubPasteResult> {
      const parsed = parseGithubPasteUrl(url);
      if (!parsed) return { success: false, error: 'Paste a GitHub URL.' };
      if (parsed.kind === 'blob') return embedBlob(parsed);
      return titleLink(parsed);
    },

    async importIssue(url: string): Promise<{ title: string; content: string; htmlUrl: string }> {
      const parsed = parseIssueUrl(url);
      if (!parsed) throw new Error('Paste a GitHub issue URL.');
      const token = await requireToken();
      const issue = await githubRequest<GitHubIssuePayload>(
        token,
        `/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`
      );
      return {
        title: issue.title,
        content: noteFromIssue(issue),
        htmlUrl: issue.html_url,
      };
    },

    listWatchers(): GitHubWatcher[] {
      return readStore().watchers;
    },

    addWatcher(raw: string, notebookId = 'inbox'): GitHubWatcher {
      const spec = parseWatcherSpec(raw);
      if (!spec) throw new Error('Watch owner/repo, an issue URL, or a GitHub search.');
      const store = readStore();
      const existing = store.watchers.find(w => w.spec === raw.trim());
      if (existing) return existing;
      const watcher: GitHubWatcher = {
        id: randomUUID(),
        spec: raw.trim(),
        kind: spec.kind,
        label: spec.label,
        notebookId,
        lastPulledAt: null,
        lastError: null,
      };
      store.watchers.push(watcher);
      writeStore(store);
      return watcher;
    },

    removeWatcher(id: string): void {
      const store = readStore();
      store.watchers = store.watchers.filter(w => w.id !== id);
      writeStore(store);
    },

    async pullWatchers(watcherId?: string): Promise<GitHubPullResult> {
      if (!notes) throw new Error('Note store is not ready.');
      const token = await requireToken();
      const store = readStore();
      const targets = watcherId ? store.watchers.filter(w => w.id === watcherId) : store.watchers;
      const result: GitHubPullResult = { created: 0, updated: 0, skipped: 0, errors: [] };

      for (const watcher of targets) {
        const spec = parseWatcherSpec(watcher.spec);
        if (!spec) {
          watcher.lastError = 'Invalid watcher';
          result.errors.push(`${watcher.label}: invalid watcher`);
          continue;
        }
        try {
          const issues = await issuesForWatcher(token, spec);
          for (const issue of issues) {
            const action = await upsertIssue(issue, watcher.notebookId, store);
            result[action] += 1;
          }
          watcher.lastPulledAt = new Date().toISOString();
          watcher.lastError = null;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Pull failed';
          watcher.lastError = message;
          result.errors.push(`${watcher.label}: ${message}`);
        }
      }

      writeStore(store);
      return result;
    },
  };
}
