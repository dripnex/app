/**
 * Remark plugin for wikilink [[note]] syntax in Markdown preview
 *
 * Transforms [[target]] and [[target|display]] into clickable spans.
 * Navigation is handled by parent component via click delegation.
 *
 * Uses mdast text nodes with data.hName/hProperties for proper inline rendering.
 * This pattern is compatible with remark-rehype and avoids DOM nesting warnings.
 */

import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';

// Pattern: [[target]] or [[target|display]]
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Text node with hast data for rendering as span.
 * This is the standard unified pattern for inline elements.
 */
interface TextWithData {
  type: 'text';
  value: string;
  data?: {
    hName: string;
    hProperties: Record<string, string>;
  };
}

export function remarkWikilink() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return;

      const value = node.value;
      if (!value.includes('[[')) return;

      const children: TextWithData[] = [];
      let lastIndex = 0;

      // Reset lastIndex for global regex
      WIKILINK_PATTERN.lastIndex = 0;

      let match;
      while ((match = WIKILINK_PATTERN.exec(value)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }

        // Wikilink as text node with hast data
        const target = match[1]!.trim();
        const display = match[2]?.trim() || target;
        children.push({
          type: 'text',
          value: display,
          data: {
            hName: 'span',
            hProperties: {
              className: 'wikilink',
              'data-target': target,
            },
          },
        });

        lastIndex = match.index + match[0].length;
      }

      // Remaining text
      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }

      if (children.length > 0) {
        (parent.children as TextWithData[]).splice(index, 1, ...children);
        // Return new index to not break traversal
        return index + children.length;
      }
    });
  };
}
