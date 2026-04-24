/**
 * Math / LaTeX Plugin
 *
 * Registers a code block renderer for "math" and "latex" language blocks.
 * Displays LaTeX source in a styled container with a copy button.
 *
 * Limitation: This plugin only handles fenced code blocks (```math / ```latex).
 * Inline math ($...$) and display math ($$...$$) require remark-math which is
 * not currently installed. The inline CSS styles below are included for future
 * compatibility but have no effect until remark-math is added.
 *
 * No external dependencies — lightweight placeholder approach.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { PluginManifest } from '@readied/plugin-api';
import type { CodeBlockRendererProps } from '@readied/plugin-api';

// Inject styles once; keep a ref to remove on dispose
let styleInjected = false;
let styleElement: HTMLStyleElement | null = null;
function injectMathStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  styleElement = style;
  style.textContent = `
    .math-block {
      position: relative;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin: 8px 0;
      background: var(--bg-surface, var(--bg-base));
    }
    .math-block__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: var(--bg-elevated, var(--bg-surface));
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
    }
    .math-block__label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .math-block__actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .math-block__btn {
      padding: 3px 10px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: background 150ms, color 150ms;
    }
    .math-block__btn:hover {
      background: var(--accent);
      color: var(--text-on-accent, #fff);
      border-color: var(--accent);
    }
    .math-block__code {
      padding: 12px 16px;
      font-family: var(--font-mono, monospace);
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text-primary);
      text-align: center;
      max-height: 400px;
      overflow-y: auto;
    }
    .math-block__copied {
      color: var(--accent);
      font-size: 11px;
      animation: math-fade 1.5s ease-out forwards;
    }
    @keyframes math-fade {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function MathRenderer({ code }: CodeBlockRendererProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // silently fail
    }
  }, [code]);

  return (
    <div className="math-block">
      <div className="math-block__header">
        <span className="math-block__label">LaTeX Math</span>
        <div className="math-block__actions">
          {copied && <span className="math-block__copied">Copied!</span>}
          <button className="math-block__btn" onClick={copySource} type="button">
            Copy LaTeX
          </button>
        </div>
      </div>
      <div className="math-block__code">{code}</div>
    </div>
  );
}

export const mathPlugin: PluginManifest = {
  id: 'readied-math',
  name: 'Math / LaTeX',
  version: '1.0.0',
  description:
    'Renders math and latex code blocks with styled containers and copy-to-clipboard support',

  activate(context) {
    injectMathStyles();

    // Register for both "math" and "latex" fenced code blocks
    const unregisterMath = context.registerCodeBlockRenderer('math-renderer', 'math', MathRenderer);
    const unregisterLatex = context.registerCodeBlockRenderer(
      'latex-renderer',
      'latex',
      MathRenderer
    );

    context.log.info('Math/LaTeX plugin activated');

    return {
      dispose() {
        unregisterMath();
        unregisterLatex();
        if (styleElement && styleElement.parentNode) {
          styleElement.parentNode.removeChild(styleElement);
          styleElement = null;
          styleInjected = false;
        }
      },
    };
  },
};
