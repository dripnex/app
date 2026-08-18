/**
 * Product URLs and links
 */

export const URLS = {
  website: 'https://dripnex.app',
  /** Live marketing Pages until apex CNAME leaves the parking lander. */
  marketing: 'https://dripnex-marketing.pages.dev',
  docs: 'https://dripnex.app/docs',
  pricing: 'https://dripnex.app/pricing',
  download: 'https://dripnex.app/download',
  faq: 'https://dripnex.app/faq',
  changelog: 'https://dripnex.app/changelog',
  github: 'https://github.com/dripnex/readide',
  discussions: 'https://github.com/dripnex/readide/discussions',
  issues: 'https://github.com/dripnex/readide/issues',
  twitter: 'https://x.com/dripnex',
  support: 'hello@dripnex.app',
  /** Canonical API host. Requires the Worker custom domain in wrangler.toml. */
  api: 'https://api.dripnex.app',
  /** Live workers.dev until api.dripnex.app DNS is attached. */
  apiFallback: 'https://readied-api-production.readied.workers.dev',
} as const;

export type UrlsConfig = typeof URLS;
