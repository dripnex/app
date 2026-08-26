/** Buttons on Settings → Hack. Kinds match `plugins:openUserFile`. */

export const HACK_FILE_ACTIONS = [
  {
    kind: 'init',
    label: 'Init script',
    description:
      'JavaScript that runs on load. Register AI commands, listen to notes, extend the editor.',
    button: 'Open init.js',
  },
  {
    kind: 'styles',
    label: 'User stylesheet',
    description: 'CSS applied on top of the app. Save the file — changes apply immediately.',
    button: 'Open styles.css',
  },
  {
    kind: 'keymap',
    label: 'Keymap',
    description: 'JSON of command id → chord. null unbinds the default.',
    button: 'Open keymap',
  },
] as const;

export type HackFileKind = (typeof HACK_FILE_ACTIONS)[number]['kind'];
