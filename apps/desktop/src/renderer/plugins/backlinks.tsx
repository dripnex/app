import { useEffect, useState } from 'react';
import type { PluginManifest, PluginContext, ZoneComponentProps } from '@dripnex/plugin-api';
import { cssm } from '../lib/cssm';
import styles from './pluginPanel.module.css';

const sc = cssm(styles);

export function relatedBySharedTags(
  currentId: string,
  currentTags: readonly string[],
  notes: ReadonlyArray<{ id: string; title: string; tags: string[] }>
): Array<{ id: string; title: string }> {
  if (currentTags.length === 0) return [];
  const set = new Set(currentTags.map(t => t.toLowerCase()));
  return notes
    .filter(note => note.id !== currentId && note.tags.some(tag => set.has(tag.toLowerCase())))
    .slice(0, 8)
    .map(note => ({ id: note.id, title: note.title || 'Untitled' }));
}

function LinkList({
  title,
  empty,
  items,
  onOpen,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className={sc('panel')}>
      <h3 className={sc('title')}>{title}</h3>
      {items.length === 0 ? (
        <p className={sc('empty')}>{empty}</p>
      ) : (
        items.map(item => (
          <button key={item.id} type="button" className={sc('row')} onClick={() => onOpen(item.id)}>
            {item.title}
          </button>
        ))
      )}
    </div>
  );
}

function BacklinksPanel({ meta }: ZoneComponentProps) {
  const ctx = meta?.context as PluginContext | undefined;
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (!ctx) return;
    let seq = 0;
    const load = async () => {
      const token = ++seq;
      const note = ctx.app.getCurrentNote();
      if (!note) {
        if (token === seq) setItems([]);
        return;
      }
      const links = await ctx.data.getBacklinks(note.id);
      if (token !== seq) return;
      setItems(links.map(link => ({ id: link.noteId, title: link.noteTitle || 'Untitled' })));
    };
    void load();
    const unsub = ctx.app.onNoteSelected(() => void load());
    return () => {
      seq += 1;
      unsub();
    };
  }, [ctx]);

  if (!ctx) return null;
  return (
    <LinkList
      title="Backlinks"
      empty="No notes link here"
      items={items}
      onOpen={id => void ctx.dispatchCommand('app:open-note', { noteId: id })}
    />
  );
}

function RelatedPanel({ meta }: ZoneComponentProps) {
  const ctx = meta?.context as PluginContext | undefined;
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (!ctx) return;
    let seq = 0;
    const load = async () => {
      const token = ++seq;
      const note = ctx.app.getCurrentNote();
      if (!note) {
        if (token === seq) setItems([]);
        return;
      }
      const [tags, listed] = await Promise.all([ctx.app.getNoteTags(note.id), ctx.app.listNotes()]);
      if (token !== seq) return;
      setItems(relatedBySharedTags(note.id, tags, listed));
    };
    void load();
    const unsub = ctx.app.onNoteSelected(() => void load());
    return () => {
      seq += 1;
      unsub();
    };
  }, [ctx]);

  if (!ctx) return null;
  return (
    <LinkList
      title="Related"
      empty="No shared tags"
      items={items}
      onOpen={id => void ctx.dispatchCommand('app:open-note', { noteId: id })}
    />
  );
}

export const backlinksPlugin: PluginManifest = {
  id: 'dripnex-backlinks',
  name: 'Backlinks',
  version: '1.0.0',
  description: 'Lists notes that link to the current note',

  activate(context) {
    context.layout.addComponent('sidebar-section', {
      id: 'backlinks:panel',
      component: BacklinksPanel,
      order: 40,
      meta: { context },
    });
    return {
      dispose() {
        context.layout.removeComponent('backlinks:panel');
      },
    };
  },
};

export const relatedNotesPlugin: PluginManifest = {
  id: 'dripnex-related-notes',
  name: 'Related Notes',
  version: '1.0.0',
  description: 'Notes that share tags with the current note',

  activate(context) {
    context.layout.addComponent('sidebar-section', {
      id: 'related:panel',
      component: RelatedPanel,
      order: 50,
      meta: { context },
    });
    return {
      dispose() {
        context.layout.removeComponent('related:panel');
      },
    };
  },
};
