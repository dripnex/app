export type DripnexDeepLink =
  | { kind: 'auth-verify'; token: string }
  | { kind: 'note'; noteId: string; heading?: string }
  | { kind: 'notebook'; notebookId: string }
  | { kind: 'tag'; tag: string };

/**
 * Parse `dripnex://note/<id>`, `dripnex://notebook/<id>`, `dripnex://tag/<name>`,
 * and `dripnex://auth/verify?token=`.
 */
export function parseDripnexUrl(raw: string): DripnexDeepLink | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'dripnex:') return null;

  const host = parsed.hostname.toLowerCase();
  const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  const heading = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)) : undefined;

  if (host === 'auth' && (path === 'verify' || parsed.pathname === '/verify')) {
    const token = parsed.searchParams.get('token');
    return token ? { kind: 'auth-verify', token } : null;
  }

  if (host === 'note') {
    const noteId = path || parsed.searchParams.get('id') || '';
    if (!noteId) return null;
    return heading ? { kind: 'note', noteId, heading } : { kind: 'note', noteId };
  }

  if (host === 'notebook' || host === 'book') {
    const notebookId = path || parsed.searchParams.get('id') || '';
    if (!notebookId) return null;
    return { kind: 'notebook', notebookId };
  }

  if (host === 'tag') {
    const tag = path || parsed.searchParams.get('name') || '';
    if (!tag) return null;
    return { kind: 'tag', tag };
  }

  return null;
}
