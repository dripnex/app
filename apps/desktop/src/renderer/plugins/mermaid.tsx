/**
 * Mermaid Diagram Plugin
 *
 * Registers a code block renderer for "mermaid" language blocks.
 * Displays the mermaid source in a styled container with a
 * "Copy for Mermaid Live" button (avoids bundling the 2MB+ mermaid lib).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { PluginManifest } from '@dripnex/plugin-api';
import type { CodeBlockRendererProps } from '@dripnex/plugin-api';

// Inject styles once; keep a ref to remove on dispose
let styleInjected = false;
let styleElement: HTMLStyleElement | null = null;
function injectMermaidStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  styleElement = style;
  style.textContent = `
    .mermaid-block {
      position: relative;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin: 8px 0;
      background: var(--bg-surface, var(--bg-base));
    }
    .mermaid-block__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: var(--bg-elevated, var(--bg-surface));
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
    }
    .mermaid-block__label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .mermaid-block__actions {
      display: flex;
      gap: 6px;
    }
    .mermaid-block__btn {
      padding: 3px 10px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: background 150ms, color 150ms;
    }
    .mermaid-block__btn:hover {
      background: var(--accent);
      color: var(--text-on-accent, #fff);
      border-color: var(--accent);
    }
    .mermaid-block__code {
      padding: 12px;
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text-primary);
      max-height: 400px;
      overflow-y: auto;
    }
    .mermaid-block__copied {
      color: var(--accent);
      font-size: 11px;
      animation: mermaid-fade 1.5s ease-out forwards;
    }
    @keyframes mermaid-fade {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function MermaidRenderer({ code }: CodeBlockRendererProps) {
  const [copied, setCopied] = useState(false);
  const [liveHint, setLiveHint] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
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

  const copyForLive = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setLiveHint(true);
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
      liveTimeoutRef.current = setTimeout(() => setLiveHint(false), 3000);
    } catch {
      // silently fail
    }
  }, [code]);

  return (
    <div className="mermaid-block">
      <div className="mermaid-block__header">
        <span className="mermaid-block__label">Mermaid Diagram</span>
        <div className="mermaid-block__actions">
          {copied && <span className="mermaid-block__copied">Copied!</span>}
          {liveHint && (
            <span className="mermaid-block__copied">Copied! Paste at mermaid.live/edit</span>
          )}
          <button className="mermaid-block__btn" onClick={copySource} type="button">
            Copy
          </button>
          <button className="mermaid-block__btn" onClick={copyForLive} type="button">
            Copy for Mermaid Live
          </button>
        </div>
      </div>
      <div className="mermaid-block__code">{code}</div>
    </div>
  );
}

export const mermaidPlugin: PluginManifest = {
  id: 'dripnex-mermaid',
  name: 'Mermaid Diagrams',
  version: '1.0.0',
  description:
    'Renders mermaid code blocks with a styled preview container and copy for Mermaid Live editor',

  activate(context) {
    injectMermaidStyles();

    const unregisterRenderer = context.registerCodeBlockRenderer(
      'mermaid-renderer',
      'mermaid',
      MermaidRenderer
    );

    context.log.info('Mermaid diagram plugin activated');

    return {
      dispose() {
        unregisterRenderer();
        if (styleElement && styleElement.parentNode) {
          styleElement.parentNode.removeChild(styleElement);
          styleElement = null;
          styleInjected = false;
        }
      },
    };
  },
};
