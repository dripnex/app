/**
 * Math / LaTeX Plugin
 *
 * Renders $inline$, $$display$$, and ```math / ```latex fences with KaTeX.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { PluginManifest } from '@dripnex/plugin-api';
import type { CodeBlockRendererProps } from '@dripnex/plugin-api';
import { renderLatex } from './mathRender';

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
    .math-block__preview {
      padding: 16px 20px;
      overflow-x: auto;
      text-align: center;
      color: var(--text-primary);
    }
    .math-block__code {
      padding: 12px 16px;
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text-primary);
      max-height: 400px;
      overflow-y: auto;
      border-top: 1px solid var(--border);
    }
    .math-block__error {
      padding: 10px 12px;
      font-size: 12px;
      color: var(--danger, #c44);
      background: color-mix(in srgb, var(--danger, #c44) 8%, transparent);
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
  const [showSource, setShowSource] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rendered = renderLatex(code);

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
      // clipboard can fail in locked sessions
    }
  }, [code]);

  return (
    <div className="math-block">
      <div className="math-block__header">
        <span className="math-block__label">LaTeX Math</span>
        <div className="math-block__actions">
          {copied && <span className="math-block__copied">Copied!</span>}
          <button className="math-block__btn" onClick={() => setShowSource(v => !v)} type="button">
            {showSource ? 'Hide source' : 'Source'}
          </button>
          <button className="math-block__btn" onClick={copySource} type="button">
            Copy LaTeX
          </button>
        </div>
      </div>
      {rendered.error ? <div className="math-block__error">{rendered.error}</div> : null}
      {rendered.html ? (
        <div className="math-block__preview" dangerouslySetInnerHTML={{ __html: rendered.html }} />
      ) : null}
      {showSource || rendered.error ? <div className="math-block__code">{code}</div> : null}
    </div>
  );
}

export const mathPlugin: PluginManifest = {
  id: 'dripnex-math',
  name: 'Math / LaTeX',
  version: '1.1.0',
  description: 'Renders $inline$, $$display$$, and math/latex fences with KaTeX',

  activate(context) {
    injectMathStyles();

    const unregisterRemark = context.registerRemarkPlugin('math-remark', remarkMath);
    const unregisterRehype = context.registerRehypePlugin('math-rehype', [
      rehypeKatex,
      { throwOnError: false, output: 'html' },
    ]);
    const unregisterMath = context.registerCodeBlockRenderer('math-renderer', 'math', MathRenderer);
    const unregisterLatex = context.registerCodeBlockRenderer(
      'latex-renderer',
      'latex',
      MathRenderer
    );

    context.log.info('Math/LaTeX plugin activated');

    return {
      dispose() {
        unregisterRemark();
        unregisterRehype();
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
