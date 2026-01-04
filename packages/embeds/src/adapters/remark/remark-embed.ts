/**
 * Remark plugin for embed ![[file]] syntax
 *
 * IMPORTANT: This plugin is for AST traversal/extraction ONLY.
 * It does NOT create image nodes or render anything.
 * Image rendering is handled by string replacement in MarkdownPreview.tsx
 * after all embed URLs are resolved via IPC.
 */

import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';

const EMBED_PATTERN = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function remarkEmbed() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return;

      const value = node.value;
      if (!value.includes('![[')) return;

      // Keep embed syntax as-is (text nodes only)
      // Actual image rendering happens after URL resolution in MarkdownPreview
      const children: Text[] = [];
      let lastIndex = 0;

      EMBED_PATTERN.lastIndex = 0;

      let match;
      while ((match = EMBED_PATTERN.exec(value)) !== null) {
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }

        const target = match[1]!.trim();
        const display = match[2]?.trim();

        // Always keep as text - never create image nodes here
        children.push({
          type: 'text',
          value: display ? `![[${target}|${display}]]` : `![[${target}]]`,
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }

      if (children.length > 0) {
        parent.children.splice(index, 1, ...children);
        return index + children.length;
      }
    });
  };
}
