import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Columns2, GitCompare, X } from 'lucide-react';
import { diffLines, type Change } from 'diff';
import { useQueryClient } from '@tanstack/react-query';
import { noteKeys } from '../../hooks/useNotes';
import { useSyncStore, selectConflicts, type Conflict } from '../../stores/syncStore';
import { conflictNoteTitle, conflictQueueLabel } from '../../utils/conflictCopy';
import { openBothConflict } from '../../utils/openBothConflict';
import styles from './ConflictResolver.module.css';

function DiffChange({ change }: { change: Change }) {
  if (change.added) {
    return <span className={styles.diffAdded}>{change.value}</span>;
  }
  if (change.removed) {
    return <span className={styles.diffRemoved}>{change.value}</span>;
  }
  return <span className={styles.diffUnchanged}>{change.value}</span>;
}

function UnifiedDiff({
  localContent,
  remoteContent,
}: {
  localContent: string;
  remoteContent: string;
}) {
  const diff = useMemo(() => diffLines(localContent, remoteContent), [localContent, remoteContent]);

  return (
    <pre className={styles.diffContent}>
      {diff.map((change, idx) => (
        <DiffChange key={idx} change={change} />
      ))}
    </pre>
  );
}

interface ConflictResolverProps {
  variant?: 'modal' | 'inline';
}

export function ConflictResolver({ variant = 'inline' }: ConflictResolverProps) {
  const conflicts = useSyncStore(selectConflicts);
  const resolveConflict = useSyncStore(state => state.resolveConflict);
  const dismissed = useSyncStore(state => state.conflictScreenDismissed);
  const dismissConflictScreen = useSyncStore(state => state.dismissConflictScreen);
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conflict = conflicts[0] ?? null;

  useEffect(() => {
    setView('side-by-side');
    setError(null);
  }, [conflict?.noteId]);

  const invalidateNotes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: noteKeys.all });
  }, [queryClient]);

  const handleResolve = useCallback(
    async (noteId: string, resolution: 'local' | 'remote') => {
      setBusy(true);
      setError(null);
      try {
        await resolveConflict(noteId, resolution);
        invalidateNotes();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resolve conflict');
      } finally {
        setBusy(false);
      }
    },
    [invalidateNotes, resolveConflict]
  );

  const handleOpenBoth = useCallback(
    async (current: Conflict) => {
      setBusy(true);
      setError(null);
      try {
        await openBothConflict(current, {
          getNote: id => window.dripnex.notes.get(id),
          createNote: input => window.dripnex.notes.create(input),
          updateTitle: input => window.dripnex.notes.updateTitle(input),
          openNote: (id, title) => window.dripnex.windows.openNote(id, title),
          resolveLocal: id => resolveConflict(id, 'local'),
        });
        invalidateNotes();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open both versions');
      } finally {
        setBusy(false);
      }
    },
    [invalidateNotes, resolveConflict]
  );

  useEffect(() => {
    if (variant !== 'modal' || !conflict || dismissed) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => {
      const root = dialogRef.current;
      if (!root) return [];
      return [
        ...root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ),
      ];
    };
    focusables()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissConflictScreen();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [conflict, dismissed, dismissConflictScreen, variant]);

  if (!conflict) return null;
  if (variant === 'modal' && dismissed) return null;

  const title = conflictNoteTitle(conflict.localContent);
  const queue = conflictQueueLabel(0, conflicts.length);
  const titleId = `conflict-title-${variant}-${conflict.noteId}`;
  const screen = (
    <section
      ref={dialogRef}
      className={variant === 'modal' ? styles.dialog : styles.inline}
      role="dialog"
      aria-modal={variant === 'modal' ? true : undefined}
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <AlertTriangle size={18} className={styles.warningIcon} aria-hidden="true" />
          <div>
            <p className={styles.queue}>{queue}</p>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          </div>
        </div>
        {variant === 'modal' ? (
          <button
            type="button"
            className={styles.later}
            onClick={dismissConflictScreen}
            disabled={busy}
          >
            Later
          </button>
        ) : null}
      </header>

      <p className={styles.description}>
        Edited on this device and another. Keep one version, or open both and merge yourself.
      </p>

      <div className={styles.viewToggle} role="tablist" aria-label="Diff view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'side-by-side'}
          className={view === 'side-by-side' ? styles.toggleActive : styles.toggleButton}
          onClick={() => setView('side-by-side')}
        >
          <Columns2 size={14} aria-hidden="true" />
          Side by side
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'unified'}
          className={view === 'unified' ? styles.toggleActive : styles.toggleButton}
          onClick={() => setView('unified')}
        >
          <GitCompare size={14} aria-hidden="true" />
          Unified
        </button>
      </div>

      {view === 'unified' ? (
        <UnifiedDiff localContent={conflict.localContent} remoteContent={conflict.remoteContent} />
      ) : (
        <div className={styles.versions}>
          <article className={styles.version}>
            <div className={styles.versionHeader}>
              <span className={styles.versionLabel}>This device</span>
              <span className={styles.versionNumber}>v{conflict.localVersion}</span>
            </div>
            <pre className={styles.content}>{conflict.localContent}</pre>
          </article>
          <div className={styles.divider} aria-hidden="true">
            <X size={14} />
          </div>
          <article className={styles.version}>
            <div className={styles.versionHeader}>
              <span className={styles.versionLabel}>Other device</span>
              <span className={styles.versionNumber}>v{conflict.remoteVersion}</span>
            </div>
            <pre className={styles.content}>{conflict.remoteContent}</pre>
          </article>
        </div>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.keepLocal}
          onClick={() => void handleResolve(conflict.noteId, 'local')}
          disabled={busy}
        >
          <Check size={14} aria-hidden="true" />
          Keep this device
        </button>
        <button
          type="button"
          className={styles.keepRemote}
          onClick={() => void handleResolve(conflict.noteId, 'remote')}
          disabled={busy}
        >
          Keep other
        </button>
        <button
          type="button"
          className={styles.openBoth}
          onClick={() => void handleOpenBoth(conflict)}
          disabled={busy}
        >
          Open both
        </button>
      </div>
    </section>
  );

  if (variant === 'inline') return screen;

  return (
    <div className={styles.overlay} onClick={dismissConflictScreen}>
      <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        {screen}
      </div>
    </div>
  );
}
