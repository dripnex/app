import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

let service: TurndownService | null = null;

function getService(): TurndownService {
  if (!service) {
    service = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
    service.use(gfm);
  }
  return service;
}

/**
 * Convert HTML to GFM markdown.
 * Primarily used to convert pasted HTML tables to markdown table syntax.
 */
export function htmlToGfmMarkdown(html: string): string {
  return getService().turndown(html);
}
