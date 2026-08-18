'use client';

import { useMemo, useState } from 'react';
import { marked } from 'marked';
import { notebooks, seedNotes, type DemoNote, type DemoNotebook } from './demoNotes';
import styles from './ProductDemo.module.css';

type Filter = 'all' | DemoNotebook;
type Mode = 'write' | 'read' | 'split';

marked.setOptions({ gfm: true, breaks: true });

function firstLine(content: string): string {
  return (
    content
      .split('\n')
      .map(line => line.replace(/^#+\s*/, '').trim())
      .find(Boolean) ?? ''
  );
}

export default function ProductDemo() {
  const [notes, setNotes] = useState<DemoNote[]>(seedNotes);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState(seedNotes[0].id);
  const [mode, setMode] = useState<Mode>('split');

  const visible = useMemo(
    () => (filter === 'all' ? notes : notes.filter(note => note.notebook === filter)),
    [filter, notes]
  );

  const selected = visible.find(note => note.id === selectedId) ?? visible[0] ?? null;

  function selectFilter(next: Filter) {
    setFilter(next);
    const first = next === 'all' ? notes[0] : notes.find(note => note.notebook === next);
    if (first) setSelectedId(first.id);
  }

  function updateSelected(patch: Partial<Pick<DemoNote, 'title' | 'content'>>) {
    if (!selected) return;
    setNotes(current =>
      current.map(note =>
        note.id === selected.id ? { ...note, ...patch, updated: 'just now' } : note
      )
    );
  }

  function addNote() {
    const id = `note-${Date.now()}`;
    const notebook: DemoNotebook = filter === 'all' ? 'personal' : filter;
    const note: DemoNote = {
      id,
      title: 'Untitled',
      notebook,
      updated: 'just now',
      content: '# Untitled\n\n',
    };
    setNotes(current => [note, ...current]);
    setSelectedId(id);
    setMode('write');
  }

  const html = selected ? String(marked.parse(selected.content)) : '';

  return (
    <div className={styles.shell}>
      <div className={styles.chrome}>
        <div className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className={styles.chromeTitle}>dripnex — {selected?.title ?? 'Notes'}</span>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Notebooks">
          {notebooks.map(item => {
            const count =
              item.id === 'all'
                ? notes.length
                : notes.filter(note => note.notebook === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                className={styles.sideBtn}
                data-active={filter === item.id}
                aria-label={item.label}
                onClick={() => selectFilter(item.id)}
              >
                {item.label}
                <span className={styles.count}>{count}</span>
              </button>
            );
          })}
        </aside>

        <section className={styles.list} aria-label="Notes">
          <div className={styles.listHead}>
            <span>
              {filter === 'all' ? 'All Notes' : notebooks.find(n => n.id === filter)?.label}
            </span>
            <button type="button" className={styles.newBtn} onClick={addNote}>
              New
            </button>
          </div>
          {visible.length === 0 ? (
            <p className={styles.empty}>No notes here.</p>
          ) : (
            visible.map(note => (
              <button
                key={note.id}
                type="button"
                className={styles.noteBtn}
                data-active={selected?.id === note.id}
                onClick={() => setSelectedId(note.id)}
              >
                <span className={styles.noteTitle}>{note.title}</span>
                <span className={styles.noteMeta}>
                  {note.updated} · {firstLine(note.content)}
                </span>
              </button>
            ))
          )}
        </section>

        <section className={styles.editor} aria-label="Editor">
          {selected ? (
            <>
              <div className={styles.editorBar}>
                <input
                  className={styles.titleInput}
                  value={selected.title}
                  onChange={event => updateSelected({ title: event.target.value })}
                  aria-label="Note title"
                />
                <div className={styles.modes} role="tablist" aria-label="Editor mode">
                  {(['write', 'split', 'read'] as const).map(item => (
                    <button
                      key={item}
                      type="button"
                      data-active={mode === item}
                      onClick={() => setMode(item)}
                    >
                      {item === 'write' ? 'Edit' : item === 'read' ? 'Preview' : 'Split'}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.panes} data-mode={mode}>
                {mode !== 'read' && (
                  <textarea
                    className={styles.write}
                    value={selected.content}
                    onChange={event => updateSelected({ content: event.target.value })}
                    spellCheck={false}
                    aria-label="Markdown"
                  />
                )}
                {mode !== 'write' && (
                  <div className={styles.read} dangerouslySetInnerHTML={{ __html: html }} />
                )}
              </div>
              <p className={styles.hint}>
                Runs in the browser. Download the app to keep files on disk.
              </p>
            </>
          ) : (
            <p className={styles.empty}>Select a note or create one.</p>
          )}
        </section>
      </div>
    </div>
  );
}
