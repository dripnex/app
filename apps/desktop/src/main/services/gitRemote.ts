export function normalizeGithubRemote(url: string): string | null {
  const trimmed = url.trim().replace(/\.git$/i, '');
  const match = trimmed.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/i);
  if (!match) return null;
  return `https://github.com/${match[1]}/${match[2]}.git`;
}
