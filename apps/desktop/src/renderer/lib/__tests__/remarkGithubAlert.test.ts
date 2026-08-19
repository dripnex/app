import { describe, expect, it } from 'vitest';
import { remarkGithubAlert } from '../remarkGithubAlert';

interface Node {
  type: string;
  value?: string;
  data?: { hProperties?: { className?: string[] } };
  children?: Node[];
}

function paragraph(text: string): Node {
  return { type: 'paragraph', children: [{ type: 'text', value: text }] };
}

describe('remarkGithubAlert', () => {
  it('classifies a NOTE blockquote and injects a title', () => {
    const tree: Node = {
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [paragraph('[!NOTE]'), paragraph('Useful detail')],
        },
      ],
    };

    remarkGithubAlert()(tree);

    const quote = tree.children?.[0];
    expect(quote?.data?.hProperties?.className).toEqual(['markdown-alert', 'markdown-alert-note']);
    expect(quote?.children?.[0]?.data?.hProperties?.className).toEqual(['markdown-alert-title']);
    expect(quote?.children?.[0]?.children?.[0]?.value).toBe('Note');
    expect(quote?.children?.[1]?.children?.[0]?.value).toBe('Useful detail');
  });

  it('splits a single paragraph marker + body', () => {
    const tree: Node = {
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [paragraph('[!WARNING]\nHot stove')],
        },
      ],
    };

    remarkGithubAlert()(tree);
    const quote = tree.children?.[0];
    expect(quote?.data?.hProperties?.className).toContain('markdown-alert-warning');
    expect(quote?.children?.[1]?.children?.[0]?.value).toBe('Hot stove');
  });

  it('leaves ordinary quotes alone', () => {
    const tree: Node = {
      type: 'root',
      children: [{ type: 'blockquote', children: [paragraph('Just a quote')] }],
    };
    remarkGithubAlert()(tree);
    expect(tree.children?.[0]?.data).toBeUndefined();
  });
});
