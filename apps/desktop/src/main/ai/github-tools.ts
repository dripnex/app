import type { ToolRegistry } from '@dripnex/ai-core';
import { githubRequest, parseIssueUrl } from '../integrations/github/service.js';

const BODY_CAP = 4000;

export function formatIssueHits(
  items: Array<{ title: string; html_url: string; state: string; repository_url?: string }>
): Array<{ title: string; url: string; state: string; repo: string | null }> {
  return items.map(item => {
    const repo = item.repository_url?.match(/repos\/([^/]+\/[^/]+)$/)?.[1] ?? null;
    return { title: item.title, url: item.html_url, state: item.state, repo };
  });
}

export function registerGitHubTools(
  registry: ToolRegistry,
  deps: { getToken: () => Promise<string | null> }
): void {
  const requireToken = async () => {
    const token = await deps.getToken();
    if (!token) {
      throw new Error('GitHub is not connected. Settings → Integrations → Connect GitHub.');
    }
    return token;
  };

  registry.register({
    name: 'github_search_issues',
    description:
      'Search GitHub issues the connected account can see. Returns title, url, state, and repo. Use when the user asks about GitHub work.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'GitHub search syntax, e.g. "repo:org/name is:open label:bug"',
        },
      },
      required: ['query'],
    },
    requiresConfirmation: false,
    execute: async args => {
      try {
        const token = await requireToken();
        const raw = String(args.query ?? '').trim();
        if (!raw) return { ok: false, content: 'Query is empty', error: 'Query is empty' };
        const q = /is:\s*issue/i.test(raw) ? raw : `${raw} is:issue`;
        const result = await githubRequest<{
          items: Array<{ title: string; html_url: string; state: string; repository_url?: string }>;
        }>(token, `/search/issues?q=${encodeURIComponent(q)}&per_page=5`);
        return { ok: true, content: JSON.stringify(formatIssueHits(result.items)) };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'GitHub search failed';
        return { ok: false, content: message, error: message };
      }
    },
  });

  registry.register({
    name: 'github_get_issue',
    description: 'Fetch one GitHub issue by its https://github.com/owner/repo/issues/N URL.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full GitHub issue URL' },
      },
      required: ['url'],
    },
    requiresConfirmation: false,
    execute: async args => {
      try {
        const token = await requireToken();
        const parsed = parseIssueUrl(String(args.url ?? ''));
        if (!parsed) {
          return { ok: false, content: 'Need a GitHub issue URL', error: 'Need a GitHub issue URL' };
        }
        const issue = await githubRequest<{
          title: string;
          body: string | null;
          html_url: string;
          state: string;
          labels: Array<{ name: string }>;
        }>(token, `/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`);
        const body = (issue.body ?? '').slice(0, BODY_CAP);
        return {
          ok: true,
          content: JSON.stringify({
            title: issue.title,
            url: issue.html_url,
            state: issue.state,
            labels: issue.labels.map(label => label.name),
            body,
          }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'GitHub fetch failed';
        return { ok: false, content: message, error: message };
      }
    },
  });
}
