import remarkGfm from 'remark-gfm';
import { remarkWikilink } from '@dripnex/wikilinks';
import { remarkFenceMeta } from './remarkFenceMeta';

/** Core remark plugins for the note preview. Extra plugins (math, …) append after. */
export function coreRemarkPlugins(): unknown[] {
  return [remarkGfm, remarkWikilink, remarkFenceMeta];
}
