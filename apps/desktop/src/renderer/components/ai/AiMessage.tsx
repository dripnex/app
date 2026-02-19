import { useMemo } from 'react';

interface AiMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export function AiMessage({ role, content }: AiMessageProps) {
  const isUser = role === 'user';

  const formattedContent = useMemo(() => {
    // Simple markdown rendering: bold, italic, code blocks, inline code
    let html = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }, [content]);

  return (
    <div className={`ai-message ai-message--${role}`}>
      <div className="ai-message-label">{isUser ? 'You' : 'AI'}</div>
      <div className="ai-message-content" dangerouslySetInnerHTML={{ __html: formattedContent }} />
    </div>
  );
}
