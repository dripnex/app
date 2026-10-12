import { parseFenceInfo } from '@dripnex/markdown';

interface MdastNode {
  type: string;
  lang?: string | null;
  meta?: string | null;
  data?: { hProperties?: Record<string, unknown> };
  children?: MdastNode[];
}

/** Copy `title=` / filename from a fence info-string onto the hast code node. */
export function remarkFenceMeta() {
  return (tree: MdastNode) => {
    walk(tree);
  };
}

function walk(node: MdastNode): void {
  if (node.type === 'code') {
    const parsed = parseFenceInfo([node.lang, node.meta].filter(Boolean).join(' '));
    if (parsed.filename || parsed.startLine != null || parsed.highlight) {
      node.data = node.data ?? {};
      node.data.hProperties = {
        ...node.data.hProperties,
        ...(parsed.filename ? { dataFilename: parsed.filename } : {}),
        ...(parsed.startLine != null ? { dataStartLine: String(parsed.startLine) } : {}),
        ...(parsed.highlight
          ? {
              dataHighlightStart: String(parsed.highlight.start),
              dataHighlightEnd: String(parsed.highlight.end),
            }
          : {}),
      };
    }
  }
  node.children?.forEach(walk);
}
