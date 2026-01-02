import { memo } from 'react';
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

interface FormattingToolbarProps {
  readonly editorRef: React.RefObject<MarkdownEditorHandle | null>;
}

/**
 * FormattingToolbar - Markdown formatting buttons
 *
 * Buttons are organized in groups:
 * - Text: Heading, Bold, Italic, Strikethrough, Code, Link
 * - Lists: Unordered, Ordered, Checkbox
 * - Blocks: Quote, Code Block, Horizontal Rule
 * - History: Undo, Redo
 */
export const FormattingToolbar = memo(function FormattingToolbar({
  editorRef,
}: FormattingToolbarProps) {
  return (
    <div className="formatting-toolbar" role="toolbar" aria-label="Formatting options">
      {/* Text formatting */}
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

      <div className="formatting-toolbar-divider" />

      {/* Lists */}
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

      <div className="formatting-toolbar-divider" />

      {/* Blocks */}
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

      <div className="formatting-toolbar-divider" />

      {/* History */}
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
    </div>
  );
});
