export const WELCOME_HEADLINE = 'The hackable AI note taker';

export const WELCOME_LEDE = 'Messy input becomes a document a person will send. Not a model dump.';

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
    title: 'Account first',
    desc: 'AuthGate is the first window. Sync is optional and end-to-end after you sign in.',
  },
  {
    title: 'Sendable, not a dump',
    desc: 'AI helps turn messy input into something you would actually send.',
  },
] as const;
