/**
 * Remark plugin for embed ![[file]] syntax in Markdown preview
 *
 * Transforms ![[target]] and ![[target|display]] into appropriate HTML elements
 * based on file type (image, video, audio, pdf).
 *
 * File resolution is handled by the app - this plugin just creates the elements.
 */

import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';
import { getEmbedType } from '../../core/types.js';

// Pattern: ![[target]] or ![[target|display]]
const EMBED_PATTERN = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Text node with hast data for rendering as HTML element.
 */
interface TextWithData {
  type: 'text';
  value: string;
  data?: {
    hName: string;
    hProperties: Record<string, string | boolean>;
  };
}

/**
 * Create remark plugin for embed syntax.
 *
 * @param options - Optional configuration
 * @param options.resolveUrl - Function to resolve embed target to URL (defaults to data-embed attribute)
 */
export function remarkEmbed(options?: { resolveUrl?: (target: string) => string | null }) {
  const resolveUrl = options?.resolveUrl;

  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return;

      const value = node.value;
      if (!value.includes('![[')) return;

      const children: TextWithData[] = [];
      let lastIndex = 0;

      // Reset lastIndex for global regex
      EMBED_PATTERN.lastIndex = 0;

      let match;
      while ((match = EMBED_PATTERN.exec(value)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }

        const target = match[1]!.trim();
        const display = match[2]?.trim() || target;
        const embedType = getEmbedType(target);
        const url = resolveUrl?.(target);

        // Create appropriate element based on embed type
        children.push(createEmbedNode(target, display, embedType, url));

        lastIndex = match.index + match[0].length;
      }

      // Remaining text
      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }

      if (children.length > 0) {
        (parent.children as TextWithData[]).splice(index, 1, ...children);
        return index + children.length;
      }
    });
  };
}

/**
 * Create the appropriate HTML node for an embed based on its type.
 */
function createEmbedNode(
  target: string,
  display: string,
  embedType: string,
  url: string | null | undefined
): TextWithData {
  const baseProps: Record<string, string | boolean> = {
    'data-embed': target,
    className: `embed embed-${embedType}`,
  };

  // If we have a resolved URL, use it
  if (url) {
    switch (embedType) {
      case 'image':
        return {
          type: 'text',
          value: '',
          data: {
            hName: 'img',
            hProperties: { ...baseProps, src: url, alt: display, loading: 'lazy' },
          },
        };

      case 'video':
        return {
          type: 'text',
          value: '',
          data: {
            hName: 'video',
            hProperties: { ...baseProps, src: url, controls: true },
          },
        };

      case 'audio':
        return {
          type: 'text',
          value: '',
          data: {
            hName: 'audio',
            hProperties: { ...baseProps, src: url, controls: true },
          },
        };

      case 'pdf':
        return {
          type: 'text',
          value: '',
          data: {
            hName: 'embed',
            hProperties: { ...baseProps, src: url, type: 'application/pdf' },
          },
        };
    }
  }

  // Fallback: show as placeholder link (file not resolved yet)
  return {
    type: 'text',
    value: display,
    data: {
      hName: 'span',
      hProperties: {
        ...baseProps,
        className: 'embed embed-unresolved',
        title: `Embed: ${target}`,
      },
    },
  };
}
