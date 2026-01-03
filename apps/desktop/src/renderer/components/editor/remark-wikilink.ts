/**
 * Remark plugin for wikilink [[note]] syntax in Markdown preview
 *
 * Transforms [[target]] and [[target|display]] into clickable spans.
 * Navigation is handled by parent component via click delegation.
 */

import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';

// Pattern: [[target]] or [[target|display]]
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

interface WikilinkNode {
  type: 'element';
  tagName: 'span';
  properties: {
    className: string[];
    'data-target': string;
  };
  children: Array<{ type: 'text'; value: string }>;
}

export function remarkWikilink() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return;

      const value = node.value;
      if (!value.includes('[[')) return;

      const children: Array<{ type: string; value?: string } | WikilinkNode> = [];
      let lastIndex = 0;

      // IMPORTANTE: resetear lastIndex para regex global
      WIKILINK_PATTERN.lastIndex = 0;

      let match;
      while ((match = WIKILINK_PATTERN.exec(value)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }

        // Wikilink element
        const target = match[1]!.trim();
        const display = match[2]?.trim() || target;
        children.push({
          type: 'element',
          tagName: 'span',
          properties: {
            className: ['wikilink'],
            'data-target': target,
          },
          children: [{ type: 'text', value: display }],
        } as WikilinkNode);

        lastIndex = match.index + match[0].length;
      }

      // Remaining text
      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }

      if (children.length > 0) {
        // @ts-ignore - unist types don't match hast nodes but this works with rehype
        parent.children.splice(index, 1, ...children);
        // IMPORTANTE: retornar nuevo index para no romper traversal
        return index + children.length;
      }
    });
  };
}
