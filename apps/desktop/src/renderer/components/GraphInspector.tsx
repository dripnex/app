/**
 * Knowledge inspector — select a node, read it, walk relationships.
 */

import { Activity, ArrowUpRight, Hash, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/primitives';
import { extractExcerpt, useNote } from '../hooks/useNotes';
import { useBacklinks, useOutgoingLinks } from '../hooks/useLinks';
import { kindFromTags, kindMeta, type EdgeKind, type NoteKind } from '../lib/knowledge';
import { KindDropdown } from './editor/KindDropdown';
import styles from './GraphView.module.css';

export interface GraphRelation {
  id: string;
  title: string;
  direction: 'to' | 'from';
  kind: EdgeKind;
  score?: number;
  nodeKind: NoteKind;
}

export interface GraphActivityEvent {
  id: string;
  title: string;
  detail: string;
}

interface GraphInspectorProps {
  noteId: string | null;
  relations: GraphRelation[];
  activity: GraphActivityEvent[];
  activityState: 'idle' | 'running';
  onOpen: (noteId: string) => void;
  onFocus: (noteId: string) => void;
  onAsk: (noteId: string) => void;
  onKindChange: (noteId: string, kind: NoteKind) => void;
  onDismiss: () => void;
}

export function GraphInspector({
  noteId,
  relations,
  activity,
  activityState,
  onOpen,
  onFocus,
  onAsk,
  onKindChange,
  onDismiss,
}: GraphInspectorProps) {
  const { data: note, isLoading } = useNote(noteId);
  const { data: backlinks = [] } = useBacklinks(noteId);
  const { data: outgoing = [] } = useOutgoingLinks(noteId);

  const kind = note ? kindFromTags(note.tags, note.status) : 'concept';
  const meta = kindMeta(kind);
  const excerpt = note ? extractExcerpt(note.content, 240) : '';
  const displayTags = (note?.tags ?? []).filter(tag => tag.toLowerCase() !== kind);
  const unresolved = outgoing.filter(link => !link.targetNoteId);
  const relatedCount =
    relations.length +
    unresolved.length +
    backlinks.filter(link => !relations.some(rel => rel.id === link.noteId)).length;

  return (
    <aside className={styles.inspector} aria-label="Note details">
      <div className={styles.inspectorBody}>
        {!noteId ? (
          <div className={styles.inspectorEmpty}>
            <div className={styles.emptyIcon}>
              <Hash size={18} />
            </div>
            <p className={styles.inspectorEmptyTitle}>Select a node</p>
            <p className={styles.inspectorEmptyHint}>
              Click any node in the graph to read the note and explore its relationships.
            </p>
          </div>
        ) : isLoading || !note ? (
          <p className={styles.muted}>{isLoading ? 'Loading…' : 'Note not found'}</p>
        ) : (
          <>
            <header className={styles.inspectorHead}>
              <span className={styles.kindBadge}>
                <span className={styles.swatch} style={{ background: meta.color }} />
                <KindDropdown kind={kind} onChange={next => onKindChange(note.id, next)} />
              </span>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onDismiss}
                title="Deselect"
                aria-label="Deselect note"
              >
                <X size={14} />
              </button>
            </header>

            <h3 className={styles.inspectorTitle}>{note.title || 'Untitled'}</h3>

            {displayTags.length > 0 ? (
              <ul className={styles.tagList}>
                {displayTags.map(tag => (
                  <li key={tag} className={styles.tag}>
                    #{tag}
                  </li>
                ))}
              </ul>
            ) : null}

            {excerpt ? <p className={styles.excerpt}>{excerpt}</p> : null}

            <Button
              className={styles.askBtn}
              variant="primary"
              size="md"
              icon={<Sparkles size={13} />}
              onClick={() => onAsk(note.id)}
            >
              Ask Dripnex
            </Button>

            <h4 className={styles.relHead}>
              Relationships
              <span>{Math.max(relatedCount, relations.length)}</span>
            </h4>

            {relations.length === 0 && unresolved.length === 0 ? (
              <p className={styles.muted}>No relationships yet. Ask Dripnex to infer some.</p>
            ) : (
              <ul className={styles.relList}>
                {relations.map(rel => (
                  <li key={`${rel.kind}-${rel.direction}-${rel.id}`}>
                    <button type="button" className={styles.relBtn} onClick={() => onFocus(rel.id)}>
                      <span
                        className={styles.relDot}
                        style={{ background: kindMeta(rel.nodeKind).color }}
                      />
                      <span className={styles.relVerb}>
                        {rel.direction === 'to' ? '→ relates to' : '← relates to'}
                      </span>
                      <span className={styles.relName}>{rel.title}</span>
                      <span className={styles.relMeta}>
                        {rel.kind === 'inferred' && rel.score != null ? (
                          <span className={styles.inferred}>
                            inferred {Math.round(rel.score * 100)}%
                          </span>
                        ) : null}
                        <ArrowUpRight size={12} />
                      </span>
                    </button>
                  </li>
                ))}
                {unresolved.map(link => (
                  <li key={`missing-${link.targetRef}`} className={styles.muted}>
                    unresolved [[{link.targetRef}]]
                  </li>
                ))}
              </ul>
            )}

            <div style={{ marginTop: 16 }}>
              <Button variant="secondary" size="sm" onClick={() => onOpen(note.id)}>
                Open note
              </Button>
            </div>
          </>
        )}
      </div>

      <section className={styles.activity} aria-label="Ask activity">
        <div className={styles.activityHead}>
          <span className={styles.activityTitle}>
            <Activity size={13} />
            Activity
          </span>
          <span className={`${styles.idle} ${activityState === 'running' ? styles.idleLive : ''}`}>
            {activityState === 'running' ? 'running' : 'idle'}
          </span>
        </div>
        {activity.length === 0 ? (
          <p className={styles.activityEmpty}>
            No activity yet. Ask Dripnex on a note to retrieve similar passages.
          </p>
        ) : (
          activity.map(event => (
            <div key={event.id} className={styles.event}>
              <div className={styles.eventHead}>
                <Sparkles size={11} />
                <code>{event.title}</code>
              </div>
              <p className={styles.eventBody}>{event.detail}</p>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}
