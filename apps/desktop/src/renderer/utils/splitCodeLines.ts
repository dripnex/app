import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

/** Split highlighted React children on newlines, keeping token spans intact. */
export function splitCodeLines(children: ReactNode): ReactNode[][] {
  const lines: ReactNode[][] = [[]];

  const push = (node: ReactNode) => {
    lines[lines.length - 1]?.push(node);
  };

  const walk = (nodes: ReactNode): void => {
    Children.forEach(nodes, (child, index) => {
      if (child == null || child === false) return;
      if (typeof child === 'string' || typeof child === 'number') {
        const parts = String(child).split('\n');
        parts.forEach((part, partIndex) => {
          if (partIndex > 0) lines.push([]);
          if (part) push(part);
        });
        return;
      }
      if (!isValidElement<{ children?: ReactNode }>(child)) {
        push(child);
        return;
      }
      const inner = child.props.children;
      if (inner == null || !nodeText(inner).includes('\n')) {
        push(child);
        return;
      }
      const innerLines = splitCodeLines(inner);
      innerLines.forEach((lineKids, lineIndex) => {
        if (lineIndex > 0) lines.push([]);
        if (lineKids.length > 0) {
          push(cloneElement(child, { key: `${index}-${lineIndex}` }, lineKids));
        }
      });
    });
  };

  walk(children);
  if (lines.length > 1 && (lines[lines.length - 1]?.length ?? 0) === 0) {
    lines.length -= 1;
  }
  return lines;
}

export function nodeText(node: ReactNode): string {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}
