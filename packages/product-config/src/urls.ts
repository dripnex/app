/**
 * Product URLs and links
 */

export const URLS = {
  website: 'https://readied.app',
  pricing: 'https://readied.app/pricing',
  download: 'https://readied.app/download',
  faq: 'https://readied.app/faq',
  changelog: 'https://readied.app/changelog',
  github: 'https://github.com/tomymaritano/readide',
  discussions: 'https://github.com/tomymaritano/readide/discussions',
  issues: 'https://github.com/tomymaritano/readide/issues',
  twitter: 'https://twitter.com/readiedapp',
  support: 'hello@readied.app',
} as const;

export type UrlsConfig = typeof URLS;
