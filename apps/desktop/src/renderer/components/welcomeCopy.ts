import { modAccel } from '../utils/modAccel';

export const WELCOME_HEADLINE = 'The hackable AI note taker';

export const WELCOME_LEDE = 'Messy input becomes a document a person will send. Not a model dump.';

export const WELCOME_CREATE = 'Create a note';
export const WELCOME_SKIP = 'Skip';

export function welcomeHint(): string {
  return `Press ${modAccel('P')} to open the command palette`;
}

export const WELCOME_FEATURES = [
  {
    title: 'SQLite is the store',
    desc: 'Notes live in a local database. Markdown is export, not the product.',
  },
  {
    title: 'Hackable',
    desc: 'init.js, styles.css, and satellite packs. Official themes stay empty.',
  },
  {
    title: 'Sign in only to sync',
    desc: 'Notes open without an account. Sign in when you want end-to-end sync across devices.',
  },
  {
    title: 'Sendable, not a dump',
    desc: 'AI helps turn messy input into something you would actually send.',
  },
] as const;
