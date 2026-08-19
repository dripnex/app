import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { splitCodeLines } from '../../utils/splitCodeLines';
import styles from './MarkdownPreview.module.css';

interface FenceBlockProps {
  children?: ReactNode;
}

export function FenceBlock({ children }: FenceBlockProps) {
  const code = findCodeElement(children);
  if (!code) {
    return <pre>{children}</pre>;
  }

  const { className, children: codeKids, node: _node, ...rest } = code.props;
  const filename = readFilename(rest);
  const lines = splitCodeLines(codeKids);

  return (
    <div className={styles.fence}>
      {filename ? <div className={styles.fenceChip}>{filename}</div> : null}
      <pre>
        <code className={className} {...rest}>
          {lines.map((line, index) => (
            <span key={index} className={styles.fenceLine}>
              <span className={styles.fenceGutter} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.fenceSrc}>{line.length > 0 ? line : '\n'}</span>
            </span>
          ))}
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
