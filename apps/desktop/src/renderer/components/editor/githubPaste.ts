import { GITHUB_CONNECT_REQUIRED, parseGithubPasteUrl } from '../../../shared/githubBlob';

export type GithubPasteIpcResult =
  | { success: true; markdown: string; kind: 'embed' | 'link' }
  | { success: false; error: string; connectRequired?: boolean };

export function shouldHandleGithubPaste(text: string): boolean {
  return parseGithubPasteUrl(text) !== null;
}

export function markdownFromGithubPasteResult(
  url: string,
  result: GithubPasteIpcResult
): { insert: string; error: string | null } {
  if (result.success) return { insert: result.markdown, error: null };
  if (result.connectRequired) {
    return {
      insert: `${url}\n\n> ${GITHUB_CONNECT_REQUIRED}`,
      error: GITHUB_CONNECT_REQUIRED,
    };
  }
  return { insert: url, error: result.error };
}
