import type { NoteStatus } from '../../preload/index';

export interface ParsedNoteSearch {
  text: string;
  tags: string[];
  status: NoteStatus | null;
  notebook: string | null;
  pinned: boolean | null;
  trash: boolean | null;
  archived: boolean | null;
}

const STATUS_ALIASES: Record<string, NoteStatus> = {
  active: 'active',
  on_hold: 'on_hold',
  'on-hold': 'on_hold',
  onhold: 'on_hold',
  hold: 'on_hold',
  completed: 'completed',
  done: 'completed',
  dropped: 'dropped',
};

const OPERATOR =
  /(?:^|\s)(?:(tag):([^\s]+)|#([^\s]+)|status:([^\s]+)|(?:notebook|in):([^\s]+)|is:(pinned|trash|deleted|archived))/gi;

export const SEARCH_OPERATOR_HINT =
  'tag:work · status:active · notebook:inbox · is:pinned · is:trash';

export function parseNoteSearch(raw: string): ParsedNoteSearch {
  const tags: string[] = [];
  let status: NoteStatus | null = null;
  let notebook: string | null = null;
  let pinned: boolean | null = null;
  let trash: boolean | null = null;
  let archived: boolean | null = null;

  const leftover = raw.replace(
    OPERATOR,
    (_match, tagKey, tagValue, hashTag, statusValue, notebookValue, isValue) => {
      const tag = typeof tagKey === 'string' ? tagValue : hashTag;
      if (typeof tag === 'string' && tag.length > 0) {
        tags.push(tag.toLowerCase());
      }
      if (typeof statusValue === 'string') {
        status = STATUS_ALIASES[statusValue.toLowerCase()] ?? null;
      }
      if (typeof notebookValue === 'string' && notebookValue.length > 0) {
        const name = notebookValue.toLowerCase();
        if (name === 'trash') {
          trash = true;
        } else {
          notebook = name;
        }
      }
      if (typeof isValue === 'string') {
        const flag = isValue.toLowerCase();
        if (flag === 'pinned') pinned = true;
        if (flag === 'trash' || flag === 'deleted') trash = true;
        if (flag === 'archived') archived = true;
      }
      return ' ';
    }
  );

  return {
    text: leftover.replace(/\s+/g, ' ').trim(),
    tags: [...new Set(tags)],
    status,
    notebook,
    pinned,
    trash,
    archived,
  };
}

export function matchNotebookId(
  needle: string,
  notebooks: Array<{ id: string; name: string }>
): string | undefined {
  const slug = needle.toLowerCase().replace(/\s+/g, '-');
  const found = notebooks.find(nb => {
    const name = nb.name.toLowerCase();
    return nb.id === needle || name === needle.toLowerCase() || name.replace(/\s+/g, '-') === slug;
  });
  return found?.id;
}
