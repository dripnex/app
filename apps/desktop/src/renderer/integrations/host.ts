import type { GitHubAPI, IntegrationsAPI, OnePasswordAPI } from '../../preload/api/integrations';

/**
 * Preload is not HMR'd. A running window can be a build behind the renderer.
 * Always go through this host — never `window.dripnex.<vendor>.*`.
 */
type LooseDripnex = {
  integrations?: Partial<IntegrationsAPI> | null;
  onePassword?: OnePasswordAPI | null;
};

function dripnex(): LooseDripnex | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.dripnex as LooseDripnex | undefined;
}

export function getIntegration<K extends keyof IntegrationsAPI>(
  name: K
): IntegrationsAPI[K] | null {
  return dripnex()?.integrations?.[name] ?? null;
}

export function getOnePasswordApi(): OnePasswordAPI | null {
  return getIntegration('onePassword') ?? dripnex()?.onePassword ?? null;
}

export function getGitHubApi(): GitHubAPI | null {
  return getIntegration('github');
}

export const INTEGRATION_UNAVAILABLE =
  '1Password is not available in this window. Quit Dripnex fully and open it again.';
