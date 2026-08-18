import remarkGfm from 'remark-gfm';
import { remarkWikilink } from '@dripnex/wikilinks';

/** Core remark plugins for the note preview. Extra plugins (math, …) append after. */
export function coreRemarkPlugins(): unknown[] {
  return [remarkGfm, remarkWikilink];
}
