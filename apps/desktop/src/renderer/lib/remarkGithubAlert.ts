const ALERTS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const;
export type GithubAlertKind = (typeof ALERTS)[number];

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*)$/i;

interface MdastNode {
  type: string;
  value?: string;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  children?: MdastNode[];
}

function paragraphText(node: MdastNode): string {
  return (node.children ?? [])
    .map(child => {
      if (child.type === 'text') return child.value ?? '';
      if (child.type === 'break') return '\n';
      return paragraphText(child);
    })
    .join('');
}

function titleNode(kind: GithubAlertKind): MdastNode {
  const label = kind.charAt(0) + kind.slice(1).toLowerCase();
  return {
    type: 'paragraph',
    data: {
      hProperties: { className: ['markdown-alert-title'] },
    },
    children: [{ type: 'text', value: label }],
  };
}

function applyAlert(blockquote: MdastNode): void {
  const children = blockquote.children ?? [];
  const first = children[0];
  if (!first || first.type !== 'paragraph') return;

  const text = paragraphText(first);
  const firstLine = text.split('\n')[0] ?? '';
  const match = firstLine.match(MARKER);
  if (!match) return;

  const kind = match[1]?.toUpperCase() as GithubAlertKind;
  if (!ALERTS.includes(kind)) return;

  const restOfFirst = text.slice(firstLine.length).replace(/^\n/, '');
  const nextChildren: MdastNode[] = [titleNode(kind)];
  if (restOfFirst.trim()) {
    nextChildren.push({
      type: 'paragraph',
      children: [{ type: 'text', value: restOfFirst }],
    });
  }
  nextChildren.push(...children.slice(1));

  blockquote.children = nextChildren;
  blockquote.data = {
    ...blockquote.data,
    hProperties: {
      ...blockquote.data?.hProperties,
      className: ['markdown-alert', `markdown-alert-${kind.toLowerCase()}`],
    },
  };
}

function walk(node: MdastNode): void {
  if (node.type === 'blockquote') applyAlert(node);
  node.children?.forEach(walk);
}

/** Turn `> [!NOTE]` GitHub alerts into classed blockquotes. */
export function remarkGithubAlert() {
  return (tree: MdastNode) => {
    walk(tree);
  };
}
