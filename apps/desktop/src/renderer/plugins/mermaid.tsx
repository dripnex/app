/**
 * Mermaid Diagram Plugin
 *
 * Registers a code block renderer for "mermaid" language blocks.
 * Displays the mermaid source in a styled container with a
 * "Open in Mermaid Live" button (avoids bundling the 2MB+ mermaid lib).
 */

import { useState, useCallback } from 'react';
import type { PluginManifest } from '@readied/plugin-api';
import type { CodeBlockRendererProps } from '@readied/plugin-api';

// Inject styles once
let styleInjected = false;
function injectMermaidStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
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

  const openInLive = useCallback(() => {
    // mermaid.live accepts base64-encoded JSON state
    const state = JSON.stringify({
      code,
      mermaid: { theme: 'default' },
      autoSync: true,
      updateDiagram: true,
    });
    const encoded = btoa(state);
    window.open(`https://mermaid.live/edit#base64:${encoded}`, '_blank');
  }, [code]);

  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
          <button className="mermaid-block__btn" onClick={copySource} type="button">
            Copy
          </button>
          <button className="mermaid-block__btn" onClick={openInLive} type="button">
            Open in Mermaid Live
          </button>
        </div>
      </div>
      <div className="mermaid-block__code">{code}</div>
    </div>
  );
}

export const mermaidPlugin: PluginManifest = {
  id: 'readied-mermaid',
  name: 'Mermaid Diagrams',
  version: '1.0.0',
  description:
    'Renders mermaid code blocks with a styled preview container and one-click link to Mermaid Live editor',

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
      },
    };
  },
};
