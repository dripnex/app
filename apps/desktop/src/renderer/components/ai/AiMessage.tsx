import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { sc } from './sc';

interface AiMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export function AiMessage({ role, content }: AiMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={sc('ai-message', `ai-message--${role}`)}>
      <div className={sc('ai-message-label')}>{isUser ? 'You' : 'AI'}</div>
      <div className={sc('ai-message-content')}>
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {content}
        </Markdown>
      </div>
    </div>
  );
}
