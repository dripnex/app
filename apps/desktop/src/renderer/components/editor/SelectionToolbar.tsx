import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Link,
  Hash,
  Code,
  Braces,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  PenLine,
  ArrowUp,
} from 'lucide';
import { insertGithubAlert, type GithubAlertKind } from '@dripnex/commands';
import { aiCommandStore } from '@dripnex/plugin-api';
import { Icon } from '../../ui/icons/Icon';
import { dispatchCommand, getEditorView } from '../../hooks/useCommandRegistry';
import { requestInlineEdit } from '../../editor/inlineAi/request';
import {
  editorAiContext,
  listSelectionAiCommands,
  selectionAiInstruction,
  type SelectionAiAction,
} from './selectionAiCommands';
import styles from './SelectionToolbar.module.css';

function wrapSelection(before: string, after: string): void {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  const text = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${text}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + text.length },
  });
  view.focus();
}

export function SelectionToolbar() {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [aiOpen, setAiOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const aiOpenRef = useRef(false);
  aiOpenRef.current = aiOpen;
  const registrations = useSyncExternalStore(
    cb => aiCommandStore.subscribe(cb),
    () => aiCommandStore.getState().registrations
  );
  const aiActions = listSelectionAiCommands(registrations);

  const update = useCallback(() => {
    const view = getEditorView();
    if (!view) {
      setVisible(false);
      return;
    }
    const { from, to } = view.state.selection.main;
    const interacting =
      aiOpenRef.current ||
      (barRef.current !== null && barRef.current.contains(document.activeElement));
    if (from === to && !aiOpenRef.current) {
      setVisible(false);
      setAlertOpen(false);
      return;
    }
    if (!view.hasFocus && !interacting) {
      setVisible(false);
      setAiOpen(false);
      setAlertOpen(false);
      return;
    }
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    if (!start || !end) {
      setVisible(false);
      return;
    }
    setPos({
      top: Math.min(start.top, end.top),
      left: (start.left + end.left) / 2,
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    const onSelection = () => {
      requestAnimationFrame(update);
    };
    document.addEventListener('selectionchange', onSelection);
    window.addEventListener('resize', onSelection);
    window.addEventListener('mouseup', onSelection);
    window.addEventListener('keyup', onSelection);
    return () => {
      document.removeEventListener('selectionchange', onSelection);
      window.removeEventListener('resize', onSelection);
      window.removeEventListener('mouseup', onSelection);
      window.removeEventListener('keyup', onSelection);
    };
  }, [update]);

  useEffect(() => {
    if (!visible) return;
    const onDown = (event: MouseEvent) => {
      if (barRef.current?.contains(event.target as Node)) return;
      setAiOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [visible]);

  useEffect(() => {
    const onOpen = () => {
      aiOpenRef.current = true;
      setAlertOpen(false);
      setAiError(null);
      setAiOpen(true);
      requestAnimationFrame(update);
    };
    window.addEventListener('dripnex:ai:open-inline', onOpen);
    return () => window.removeEventListener('dripnex:ai:open-inline', onOpen);
  }, [update]);

  const runAi = async (instruction: string, keepFence = false) => {
    const view = getEditorView();
    if (!view || aiBusy) return;
    const { from, to } = view.state.selection.main;
    const initialContent = view.state.doc.toString();
    const ctx = editorAiContext(initialContent, from, to);
    setAiBusy(true);
    setAiError(null);
    const result = await requestInlineEdit({
      content: initialContent,
      from,
      to,
      title: ctx.title,
      instruction,
      keepFence,
    });
    setAiBusy(false);
    if (!result.ok) {
      setAiError(
        result.reason === 'missing-key'
          ? 'Set up AI in Settings → AI'
          : 'Could not edit the selection'
      );
      return;
    }
    if (view.state.doc.toString() !== initialContent) {
      setAiError('Note changed — try again');
      return;
    }
    if (from > view.state.doc.length || to > view.state.doc.length) return;
    view.dispatch({
      changes: { from, to, insert: result.text },
      selection: { anchor: from, head: from + result.text.length },
    });
    view.focus();
    setAiOpen(false);
    setAiPrompt('');
  };

  const runSelectionAction = (action: SelectionAiAction) => {
    const view = getEditorView();
    if (!view || aiBusy) return;
    const { from, to } = view.state.selection.main;
    const ctx = editorAiContext(view.state.doc.toString(), from, to);
    const { instruction, keepFence } = selectionAiInstruction(action, ctx);
    void runAi(instruction, keepFence);
  };

  if (!visible) return null;

  return createPortal(
    <div
      ref={barRef}
      className={styles.bar}
      style={{ top: Math.max(8, pos.top - 48), left: pos.left }}
      role="toolbar"
      aria-label="Selection formatting"
      onMouseDown={event => event.preventDefault()}
    >
      <button
        type="button"
        className={`${styles.btn} ${aiOpen ? styles.btnActive : ''}`}
        title="Edit with AI"
        aria-expanded={aiOpen}
        onClick={() => setAiOpen(open => !open)}
      >
        <Icon icon={PenLine} size={15} />
      </button>
      <span className={styles.sep} />
      <button
        type="button"
        className={styles.btn}
        title="Heading"
        onClick={() => dispatchCommand('editor:insert-heading')}
      >
        <Icon icon={Hash} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Bold"
        onClick={() => dispatchCommand('editor:toggle-bold')}
      >
        <Icon icon={Bold} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Italic"
        onClick={() => dispatchCommand('editor:toggle-italic')}
      >
        <Icon icon={Italic} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Strikethrough"
        onClick={() => dispatchCommand('editor:toggle-strikethrough')}
      >
        <Icon icon={Strikethrough} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Highlight"
        onClick={() => wrapSelection('<mark>', '</mark>')}
      >
        <Icon icon={Highlighter} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Link"
        onClick={() => dispatchCommand('editor:insert-link')}
      >
        <Icon icon={Link} size={15} />
      </button>
      <span className={styles.sep} />
      <button
        type="button"
        className={styles.btn}
        title="Inline code"
        onClick={() => dispatchCommand('editor:toggle-inline-code')}
      >
        <Icon icon={Code} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Code block"
        onClick={() => dispatchCommand('editor:insert-code-block')}
      >
        <Icon icon={Braces} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Quote"
        onClick={() => dispatchCommand('editor:insert-quote')}
      >
        <Icon icon={Quote} size={15} />
      </button>
      <button
        type="button"
        className={`${styles.btn} ${alertOpen ? styles.btnActive : ''}`}
        title="GitHub alert"
        aria-expanded={alertOpen}
        onClick={() => {
          setAiOpen(false);
          setAlertOpen(open => !open);
        }}
      >
        <span className={styles.alertMark}>!</span>
      </button>
      <span className={styles.sep} />
      <button
        type="button"
        className={styles.btn}
        title="Bullets"
        onClick={() => dispatchCommand('editor:insert-unordered-list')}
      >
        <Icon icon={List} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Numbered list"
        onClick={() => dispatchCommand('editor:insert-ordered-list')}
      >
        <Icon icon={ListOrdered} size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Checkbox"
        onClick={() => dispatchCommand('editor:insert-checkbox')}
      >
        <Icon icon={CheckSquare} size={15} />
      </button>

      {alertOpen ? (
        <div className={styles.ai} role="menu" aria-label="GitHub alerts">
          {(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              className={styles.aiItem}
              onClick={() => {
                const view = getEditorView();
                if (view) insertGithubAlert(view, kind as GithubAlertKind);
                setAlertOpen(false);
              }}
            >
              {kind.charAt(0) + kind.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      ) : null}

      {aiOpen ? (
        <div className={styles.ai} onMouseDown={event => event.stopPropagation()}>
          <form
            className={styles.aiForm}
            onSubmit={event => {
              event.preventDefault();
              if (!aiPrompt.trim() || aiBusy) return;
              void runAi(aiPrompt.trim());
            }}
          >
            <input
              className={styles.aiInput}
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              placeholder={aiBusy ? 'Editing…' : 'Edit with AI…'}
              disabled={aiBusy}
              autoFocus
            />
            <button type="submit" className={styles.aiSend} aria-label="Run" disabled={aiBusy}>
              <Icon icon={ArrowUp} size={14} />
            </button>
          </form>
          {aiError ? <p className={styles.aiError}>{aiError}</p> : null}
          {aiActions.map(action => (
            <button
              key={action.id}
              type="button"
              className={styles.aiItem}
              disabled={aiBusy}
              onClick={() => runSelectionAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
