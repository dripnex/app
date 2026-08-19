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
import { requestInlineEdit } from '../../editor/inlineAi/request';
import styles from './SelectionToolbar.module.css';

const AI_ACTIONS = [
  {
    id: 'mermaid',
    label: 'Create a Mermaid diagram',
    instruction: 'Convert the selection into a mermaid diagram.',
    keepFence: true,
  },
  {
    id: 'table',
    label: 'Convert to Markdown table',
    instruction: 'Convert the selection into a GitHub-flavored markdown table.',
  },
  {
    id: 'proofread',
    label: 'Proofread',
    instruction: 'Fix grammar and spelling. Keep the meaning and markdown.',
  },
  {
    id: 'reformat',
    label: 'Reformat',
    instruction: 'Clean the markdown structure. Do not change meaning.',
  },
  {
    id: 'improve',
    label: 'Improve writing',
    instruction: 'Improve clarity and rhythm. Keep the author voice and markdown.',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    instruction: 'Condense the selection into a concise summary.',
  },
  {
    id: 'bullets',
    label: 'Convert to bullet list',
    instruction: 'Rewrite the selection as a Markdown bulleted list.',
  },
  {
    id: 'tasks',
    label: 'Convert to task list',
    instruction: 'Rewrite the selection as a Markdown task list (- [ ] items).',
  },
  {
    id: 'headings',
    label: 'Add headings',
    instruction: 'Reorganize the selection with appropriate Markdown headings.',
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
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
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
    setAiBusy(true);
    setAiError(null);
    const result = await requestInlineEdit({
      content: view.state.doc.toString(),
      from,
      to,
      title: '',
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
    if (from > view.state.doc.length || to > view.state.doc.length) return;
    view.dispatch({
      changes: { from, to, insert: result.text },
      selection: { anchor: from, head: from + result.text.length },
    });
    view.focus();
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
              <ArrowUp size={14} />
            </button>
          </form>
          {aiError ? <p className={styles.aiError}>{aiError}</p> : null}
          {AI_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              className={styles.aiItem}
              disabled={aiBusy}
              onClick={() =>
                void runAi(action.instruction, 'keepFence' in action && action.keepFence)
              }
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
