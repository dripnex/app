export type DemoNotebook = 'work' | 'personal';

export interface DemoNote {
  id: string;
  title: string;
  notebook: DemoNotebook;
  updated: string;
  content: string;
}

export const notebooks: { id: DemoNotebook | 'all'; label: string }[] = [
  { id: 'all', label: 'All Notes' },
  { id: 'work', label: 'Work' },
  { id: 'personal', label: 'Personal' },
];

export const seedNotes: DemoNote[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    notebook: 'personal',
    updated: 'just now',
    content: `# Welcome

This is Dripnex, running here in the page.

- Edit this note
- Open another from the list
- Press **New** and start one of your own

Nothing is uploaded. Download the app when you want the same editor with files on disk.
`,
  },
  {
    id: 'release',
    title: 'How a release goes out',
    notebook: 'work',
    updated: '2d ago',
    content: `# How a release goes out

Writing this down because I re-derive it every time.

1. Land the work on \`develop\`
2. Promote with a merge commit, never squash
3. Tag. The signed build comes from the tag.

The notes stay \`.md\` either way.
`,
  },
  {
    id: 'search',
    title: 'Local search notes',
    notebook: 'work',
    updated: '1w ago',
    content: `# Local search notes

SQLite is an index, not the source of truth.

If the database goes away, rebuild it from the files.
Do not invent a format that only we can read.
`,
  },
  {
    id: 'tuesday',
    title: 'Tuesday',
    notebook: 'personal',
    updated: '5d ago',
    content: `# Tuesday

Local files. Standard Markdown.

- [x] Write the note
- [ ] Leave it on disk

If the app disappears, the files do not.
`,
  },
];
