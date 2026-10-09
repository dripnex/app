import {
  Children,
  isValidElement,
  useCallback,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { nodeText, splitCodeLines } from '../../utils/splitCodeLines';
import styles from './MarkdownPreview.module.css';

interface FenceBlockProps {
  children?: ReactNode;
}

export function FenceBlock({ children }: FenceBlockProps) {
  const code = findCodeElement(children);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!code) return;
    const source = nodeText(code.props.children);
    await navigator.clipboard.writeText(source.replace(/\n$/, ''));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, [code]);

  if (!code) {
    return <pre>{children}</pre>;
  }

  const { className, children: codeKids, node: _node, ...rest } = code.props;
  const filename = readFilename(rest);
  const startLine = readPositiveInt(rest, ['data-start-line', 'dataStartLine']) ?? 1;
  const highlightStart = readPositiveInt(rest, ['data-highlight-start', 'dataHighlightStart']);
  const highlightEnd = readPositiveInt(rest, ['data-highlight-end', 'dataHighlightEnd']);
  const lines = splitCodeLines(codeKids);

  return (
    <div className={styles.fence}>
      {filename ? <div className={styles.fenceChip}>{filename}</div> : null}
      <button
        type="button"
        className={styles.fenceCopy}
        aria-label="Copy code block"
        onClick={() => void copy()}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre>
        <code className={className} {...rest}>
          {lines.map((line, index) => {
            const lineNumber = startLine + index;
            const highlighted =
              highlightStart != null &&
              highlightEnd != null &&
              lineNumber >= highlightStart &&
              lineNumber <= highlightEnd;
            return (
              <span
                key={index}
                className={[styles.fenceLine, highlighted ? styles.fenceLineHighlight : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={styles.fenceGutter} aria-hidden="true">
                  {lineNumber}
                </span>
                <span className={styles.fenceSrc}>{line.length > 0 ? line : '\n'}</span>
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

type CodeProps = {
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
};

function findCodeElement(children: ReactNode): ReactElement<CodeProps> | null {
  const found = Children.toArray(children).find(
    child => isValidElement(child) && child.type === 'code'
  );
  return isValidElement(found) ? (found as ReactElement<CodeProps>) : null;
}

function readFilename(props: Record<string, unknown>): string | null {
  const value = props['data-filename'] ?? props.dataFilename;
  return typeof value === 'string' && value.trim() ? value : null;
}

function readPositiveInt(props: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = props[key];
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return null;
}
