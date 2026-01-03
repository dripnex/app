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
} from 'lucide-react';
import type { MarkdownEditorHandle } from '../MarkdownEditor';
import { useToolbarOverflow, type ToolbarVisibility } from '../../hooks/useToolbarOverflow';

interface FormattingToolbarProps {
  readonly editorRef: React.RefObject<MarkdownEditorHandle | null>;
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
  editorRef,
  onVisibilityChange,
  containerRef,
}: FormattingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { visibility } = useToolbarOverflow({ toolbarRef, containerRef });

  // Notify parent of visibility changes (for ActionsPanel overflow menu)
  useEffect(() => {
    onVisibilityChange?.(visibility);
  }, [visibility, onVisibilityChange]);

  return (
    <div
      ref={toolbarRef}
      className="formatting-toolbar"
      role="toolbar"
      aria-label="Formatting options"
    >
      {/* Text formatting - always visible */}
      {visibility.text && (
        <>
          <div className="formatting-toolbar-group">
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertHeading(2)}
              title="Heading (H2)"
              aria-label="Insert heading"
            >
              <Heading2 size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.toggleBold()}
              title="Bold (⌘B)"
              aria-label="Toggle bold"
            >
              <Bold size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.toggleItalic()}
              title="Italic (⌘I)"
              aria-label="Toggle italic"
            >
              <Italic size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.toggleStrikethrough()}
              title="Strikethrough"
              aria-label="Toggle strikethrough"
            >
              <Strikethrough size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.toggleInlineCode()}
              title="Inline Code"
              aria-label="Toggle inline code"
            >
              <Code size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertLink()}
              title="Link (⌘K)"
              aria-label="Insert link"
            >
              <Link size={18} />
            </button>
          </div>
          {visibility.lists && <div className="formatting-toolbar-divider" />}
        </>
      )}

      {/* Lists - hidden when width < 300px */}
      {visibility.lists && (
        <>
          <div className="formatting-toolbar-group">
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertUnorderedList()}
              title="Bullet List"
              aria-label="Insert bullet list"
            >
              <List size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertOrderedList()}
              title="Numbered List"
              aria-label="Insert numbered list"
            >
              <ListOrdered size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertCheckbox()}
              title="Checkbox"
              aria-label="Insert checkbox"
            >
              <CheckSquare size={18} />
            </button>
          </div>
          {visibility.blocks && <div className="formatting-toolbar-divider" />}
        </>
      )}

      {/* Blocks - hidden when width < 400px */}
      {visibility.blocks && (
        <>
          <div className="formatting-toolbar-group">
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertQuote()}
              title="Quote"
              aria-label="Insert quote"
            >
              <Quote size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertCodeBlock()}
              title="Code Block"
              aria-label="Insert code block"
            >
              <FileCode size={18} />
            </button>
            <button
              type="button"
              className="formatting-toolbar-btn"
              onClick={() => editorRef.current?.insertHorizontalRule()}
              title="Horizontal Rule"
              aria-label="Insert horizontal rule"
            >
              <Minus size={18} />
            </button>
          </div>
          {visibility.history && <div className="formatting-toolbar-divider" />}
        </>
      )}

      {/* History - hidden when width < 500px */}
      {visibility.history && (
        <div className="formatting-toolbar-group">
          <button
            type="button"
            className="formatting-toolbar-btn formatting-toolbar-btn--undo"
            onClick={() => editorRef.current?.undo()}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            className="formatting-toolbar-btn formatting-toolbar-btn--redo"
            onClick={() => editorRef.current?.redo()}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            <Redo2 size={18} />
          </button>
        </div>
      )}
    </div>
  );
});

// Re-export type for consumers
export type { ToolbarVisibility } from '../../hooks/useToolbarOverflow';
