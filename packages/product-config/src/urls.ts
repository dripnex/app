/**
 * Product URLs and links
 */

export const URLS = {
  website: 'https://dripnex.app',
  pricing: 'https://dripnex.app/pricing',
  download: 'https://dripnex.app/download',
  faq: 'https://dripnex.app/faq',
  changelog: 'https://dripnex.app/changelog',
  github: 'https://github.com/dripnex/readide',
  discussions: 'https://github.com/dripnex/readide/discussions',
  issues: 'https://github.com/dripnex/readide/issues',
  twitter: 'https://twitter.com/dripnexapp',
  support: 'hello@dripnex.app',
} as const;

export type UrlsConfig = typeof URLS;
