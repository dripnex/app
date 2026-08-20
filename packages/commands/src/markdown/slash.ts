export type SlashSection = 'Basic Formatting' | 'GitHub Alerts';

export interface SlashItem {
  id: string;
  label: string;
  detail: string;
  section: SlashSection;
  keywords: string[];
  /** Inserted in place of `/query`. */
  snippet: string;
  /** Cursor offset from the start of the snippet. */
  cursor: number;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'codeblock',
    label: 'Codeblock',
    detail: '```',
    section: 'Basic Formatting',
    keywords: ['code', 'fence', '```'],
    snippet: '```\n\n```',
    cursor: 3,
  },
  {
    id: 'h1',
    label: 'Heading 1',
    detail: '#',
    section: 'Basic Formatting',
    keywords: ['h1', 'title'],
    snippet: '# ',
    cursor: 2,
  },
  {
    id: 'h2',
    label: 'Heading 2',
    detail: '##',
    section: 'Basic Formatting',
    keywords: ['h2'],
    snippet: '## ',
    cursor: 3,
  },
  {
    id: 'h3',
    label: 'Heading 3',
    detail: '###',
    section: 'Basic Formatting',
    keywords: ['h3'],
    snippet: '### ',
    cursor: 4,
  },
  {
    id: 'h4',
    label: 'Heading 4',
    detail: '####',
    section: 'Basic Formatting',
    keywords: ['h4'],
    snippet: '#### ',
    cursor: 5,
  },
  {
    id: 'hr',
    label: 'Horizontal Rule',
    detail: '---',
    section: 'Basic Formatting',
    keywords: ['rule', 'divider', 'hr'],
    snippet: '---\n',
    cursor: 4,
  },
  {
    id: 'ol',
    label: 'Ordered List',
    detail: '1.',
    section: 'Basic Formatting',
    keywords: ['numbered', 'ol'],
    snippet: '1. ',
    cursor: 3,
  },
  {
    id: 'task',
    label: 'Task List',
    detail: '- [ ]',
    section: 'Basic Formatting',
    keywords: ['todo', 'checkbox', 'task'],
    snippet: '- [ ] ',
    cursor: 6,
  },
  {
    id: 'ul',
    label: 'Unordered List',
    detail: '-',
    section: 'Basic Formatting',
    keywords: ['bullet', 'ul'],
    snippet: '- ',
    cursor: 2,
  },
  {
    id: 'quote',
    label: 'Quote',
    detail: '>',
    section: 'Basic Formatting',
    keywords: ['blockquote'],
    snippet: '> ',
    cursor: 2,
  },
  ...(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const).map(kind => ({
    id: `alert-${kind.toLowerCase()}`,
    label: `${kind.charAt(0)}${kind.slice(1).toLowerCase()} Alert`,
    detail: `> [!${kind}]`,
    section: 'GitHub Alerts' as const,
    keywords: ['alert', 'callout', kind.toLowerCase()],
    snippet: `> [!${kind}]\n> `,
    cursor: `> [!${kind}]\n> `.length,
  })),
];

/** `/query` on an otherwise empty line (leading spaces allowed). */
export function matchSlashLine(linePrefix: string): { fromCol: number; query: string } | null {
  const match = linePrefix.match(/^(\s*)\/([a-z0-9+-]*)$/i);
  if (!match) return null;
  const indent = match[1] ?? '';
  return { fromCol: indent.length, query: (match[2] ?? '').toLowerCase() };
}

export function filterSlashItems(query: string): SlashItem[] {
  if (!query) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(item => {
    const hay = [item.label, item.detail, item.id, ...item.keywords].join(' ').toLowerCase();
    return hay.includes(query);
  });
}

export const FENCE_LANGUAGES = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'py',
  'go',
  'rs',
  'sh',
  'bash',
  'md',
  'css',
  'html',
  'sql',
  'yaml',
  'yml',
  'toml',
  'c',
  'cpp',
  'java',
  'swift',
  'kotlin',
  'ruby',
  'php',
  'text',
] as const;

/** Line is an opening fence: ``` or ```ts */
export function matchFenceLang(linePrefix: string): { fromCol: number; query: string } | null {
  const match = linePrefix.match(/^(`{3})([a-z0-9+-]*)$/i);
  if (!match) return null;
  return { fromCol: 3, query: (match[2] ?? '').toLowerCase() };
}

export function filterFenceLanguages(query: string): string[] {
  if (!query) return [...FENCE_LANGUAGES];
  return FENCE_LANGUAGES.filter(lang => lang.startsWith(query));
}
