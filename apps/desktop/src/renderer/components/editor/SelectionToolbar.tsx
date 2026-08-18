import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { insertGithubAlert, type GithubAlertKind } from '@dripnex/commands';
import { dispatchCommand, getEditorView } from '../../hooks/useCommandRegistry';
import styles from './SelectionToolbar.module.css';

const AI_ACTIONS = [
  {
    id: 'mermaid',
    label: 'Create a Mermaid diagram',
    system:
      'Convert the selection into a mermaid diagram. Reply with a mermaid fenced code block only.',
  },
  {
    id: 'table',
    label: 'Convert to Markdown table',
    system: 'Convert the selection into a GitHub-flavored markdown table. Reply with the table only.',
  },
  {
    id: 'proofread',
    label: 'Proofread',
    system:
      'Fix grammar and spelling. Keep the meaning and markdown. Reply with the revised text only.',
  },
  {
    id: 'reformat',
    label: 'Reformat',
    system: 'Clean the markdown structure. Do not change meaning. Reply with the revised markdown only.',
  },
  {
    id: 'improve',
    label: 'Improve writing',
    system:
      'Improve clarity and rhythm. Keep the author voice and markdown. Reply with the revised text only.',
  },
] as const;

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
  const barRef = useRef<HTMLDivElement>(null);
  const aiOpenRef = useRef(false);
  aiOpenRef.current = aiOpen;

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
    if (from === to) {
      setVisible(false);
      setAiOpen(false);
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

  const runAi = (system: string, instruction?: string) => {
    window.dispatchEvent(
      new CustomEvent('dripnex:ai:edit', {
        detail: { system, instruction },
      })
    );
    setAiOpen(false);
    setAiPrompt('');
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
        <PenLine size={15} />
      </button>
      <span className={styles.sep} />
      <button
        type="button"
        className={styles.btn}
        title="Heading"
        onClick={() => dispatchCommand('editor:insert-heading')}
      >
        <Hash size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Bold"
        onClick={() => dispatchCommand('editor:toggle-bold')}
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Italic"
        onClick={() => dispatchCommand('editor:toggle-italic')}
      >
        <Italic size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Strikethrough"
        onClick={() => dispatchCommand('editor:toggle-strikethrough')}
      >
        <Strikethrough size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Highlight"
        onClick={() => wrapSelection('<mark>', '</mark>')}
      >
        <Highlighter size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Link"
        onClick={() => dispatchCommand('editor:insert-link')}
      >
        <Link size={15} />
      </button>
      <span className={styles.sep} />
      <button
        type="button"
        className={styles.btn}
        title="Inline code"
        onClick={() => dispatchCommand('editor:toggle-inline-code')}
      >
        <Code size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Code block"
        onClick={() => dispatchCommand('editor:insert-code-block')}
      >
        <Braces size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Quote"
        onClick={() => dispatchCommand('editor:insert-quote')}
      >
        <Quote size={15} />
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
        <List size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Numbered list"
        onClick={() => dispatchCommand('editor:insert-ordered-list')}
      >
        <ListOrdered size={15} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Checkbox"
        onClick={() => dispatchCommand('editor:insert-checkbox')}
      >
        <CheckSquare size={15} />
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
              if (!aiPrompt.trim()) return;
              runAi(
                'Follow the user instruction on the selected markdown. Reply with the result only.',
                aiPrompt.trim()
              );
            }}
          >
            <input
              className={styles.aiInput}
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              placeholder="Edit with AI…"
              autoFocus
            />
            <button type="submit" className={styles.aiSend} aria-label="Run">
              <ArrowUp size={14} />
            </button>
          </form>
          {AI_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              className={styles.aiItem}
              onClick={() => runAi(action.system)}
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
