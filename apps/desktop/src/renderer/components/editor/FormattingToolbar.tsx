import { memo, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  FileCode,
  Minus,
  Undo2,
  Redo2,
} from 'lucide';
import { Icon } from '../../ui/icons/Icon';
import { useToolbarOverflow, type ToolbarVisibility } from '../../hooks/useToolbarOverflow';
import {
  dispatchCommand,
  getCommandKeybinding,
  formatKeybinding,
} from '../../hooks/useCommandRegistry';
import { cssm } from '../../lib/cssm';
import styles from './FormattingToolbar.module.css';

const sc = cssm(styles);

interface FormattingToolbarProps {
  /** Optional callback when visibility changes (for passing to ActionsPanel) */
  readonly onVisibilityChange?: (visibility: ToolbarVisibility) => void;
  /** Ref to the parent container (for measuring available width) */
  readonly containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * FormattingToolbar - Markdown formatting buttons
 *
 * Buttons are organized in groups:
 * - Text: Heading, Bold, Italic, Strikethrough, Code, Link (always visible)
 * - Lists: Unordered, Ordered, Checkbox (hidden < 300px)
 * - Blocks: Quote, Code Block, Horizontal Rule (hidden < 400px)
 * - History: Undo, Redo (hidden < 500px)
 *
 * Uses useToolbarOverflow to adapt to available width.
 */
export const FormattingToolbar = memo(function FormattingToolbar({
  onVisibilityChange,
  containerRef,
}: FormattingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { visibility } = useToolbarOverflow({ toolbarRef, containerRef });

  // Helper: format keybinding for tooltip display
  const fmtKey = (id: string): string => {
    const kb = getCommandKeybinding(id);
    if (!kb) return '';
    return ` (${formatKeybinding(kb)})`;
  };

  // Notify parent of visibility changes (for ActionsPanel overflow menu)
  useEffect(() => {
    onVisibilityChange?.(visibility);
  }, [visibility, onVisibilityChange]);

  return (
    <div
      ref={toolbarRef}
      className={sc('formatting-toolbar')}
      role="toolbar"
      aria-label="Formatting options"
    >
      {/* Text formatting - always visible */}
      {visibility.text && (
        <>
          <div className={sc('formatting-toolbar-group')}>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-heading')}
              title={`Heading (H2)${fmtKey('editor:insert-heading')}`}
              aria-label="Insert heading"
            >
              <Icon icon={Heading2} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:toggle-bold')}
              title={`Bold${fmtKey('editor:toggle-bold')}`}
              aria-label="Toggle bold"
            >
              <Icon icon={Bold} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:toggle-italic')}
              title={`Italic${fmtKey('editor:toggle-italic')}`}
              aria-label="Toggle italic"
            >
              <Icon icon={Italic} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:toggle-strikethrough')}
              title="Strikethrough"
              aria-label="Toggle strikethrough"
            >
              <Icon icon={Strikethrough} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:toggle-inline-code')}
              title={`Inline Code${fmtKey('editor:toggle-inline-code')}`}
              aria-label="Toggle inline code"
            >
              <Icon icon={Code} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-link')}
              title={`Link${fmtKey('editor:insert-link')}`}
              aria-label="Insert link"
            >
              <Icon icon={Link} size={18} />
            </button>
          </div>
          {visibility.lists && <div className={sc('formatting-toolbar-divider')} />}
        </>
      )}

      {/* Lists - hidden when width < 300px */}
      {visibility.lists && (
        <>
          <div className={sc('formatting-toolbar-group')}>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-unordered-list')}
              title="Bullet List"
              aria-label="Insert bullet list"
            >
              <Icon icon={List} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-ordered-list')}
              title="Numbered List"
              aria-label="Insert numbered list"
            >
              <Icon icon={ListOrdered} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-checkbox')}
              title="Checkbox"
              aria-label="Insert checkbox"
            >
              <Icon icon={CheckSquare} size={18} />
            </button>
          </div>
          {visibility.blocks && <div className={sc('formatting-toolbar-divider')} />}
        </>
      )}

      {/* Blocks - hidden when width < 400px */}
      {visibility.blocks && (
        <>
          <div className={sc('formatting-toolbar-group')}>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-quote')}
              title="Quote"
              aria-label="Insert quote"
            >
              <Icon icon={Quote} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-code-block')}
              title="Code Block"
              aria-label="Insert code block"
            >
              <Icon icon={FileCode} size={18} />
            </button>
            <button
              type="button"
              className={sc('formatting-toolbar-btn')}
              onClick={() => dispatchCommand('editor:insert-horizontal-rule')}
              title="Horizontal Rule"
              aria-label="Insert horizontal rule"
            >
              <Icon icon={Minus} size={18} />
            </button>
          </div>
          {visibility.history && <div className={sc('formatting-toolbar-divider')} />}
        </>
      )}

      {/* History - hidden when width < 500px */}
      {visibility.history && (
        <div className={sc('formatting-toolbar-group')}>
          <button
            type="button"
            className={sc('formatting-toolbar-btn', 'formatting-toolbar-btn--undo')}
            onClick={() => dispatchCommand('editor:undo')}
            title={`Undo${fmtKey('editor:undo')}`}
            aria-label="Undo"
          >
            <Icon icon={Undo2} size={18} />
          </button>
          <button
            type="button"
            className={sc('formatting-toolbar-btn', 'formatting-toolbar-btn--redo')}
            onClick={() => dispatchCommand('editor:redo')}
            title={`Redo${fmtKey('editor:redo')}`}
            aria-label="Redo"
          >
            <Icon icon={Redo2} size={18} />
          </button>
        </div>
      )}
    </div>
  );
});

// Re-export type for consumers
export type { ToolbarVisibility } from '../../hooks/useToolbarOverflow';
