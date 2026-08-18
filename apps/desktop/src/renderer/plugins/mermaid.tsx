/**
 * Mermaid Diagram Plugin
 *
 * Renders ```mermaid fences to SVG via mermaid 11 (strict sanitization).
 * Falls back to the source + error if the diagram is invalid.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { PluginManifest } from '@dripnex/plugin-api';
import type { CodeBlockRendererProps } from '@dripnex/plugin-api';

let styleInjected = false;
let styleElement: HTMLStyleElement | null = null;
let mermaidReady: Promise<typeof import('mermaid')> | null = null;
let lastTheme: 'default' | 'dark' | null = null;
let renderSeq = 0;

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
      align-items: center;
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
    .mermaid-block__diagram {
      position: relative;
      height: 280px;
      overflow: hidden;
      cursor: grab;
      touch-action: none;
    }
    .mermaid-block__diagram:active {
      cursor: grabbing;
    }
    .mermaid-block__stage {
      transform-origin: 0 0;
      will-change: transform;
    }
    .mermaid-block__stage svg {
      display: block;
      max-width: none;
      height: auto;
    }
    .mermaid-block__zoom {
      display: flex;
      gap: 4px;
    }
    .mermaid-block--full {
      position: fixed;
      inset: 24px;
      z-index: 80;
      margin: 0;
      display: flex;
      flex-direction: column;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
    }
    .mermaid-block--full .mermaid-block__diagram {
      flex: 1;
      height: auto;
    }
    .mermaid-block__scrim {
      position: fixed;
      inset: 0;
      z-index: 79;
      background: color-mix(in srgb, var(--bg-base) 40%, #000);
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
      border-top: 1px solid var(--border);
    }
    .mermaid-block__error {
      padding: 10px 12px;
      font-size: 12px;
      color: var(--danger, #c44);
      background: color-mix(in srgb, var(--danger, #c44) 8%, transparent);
    }
    .mermaid-block__placeholder {
      padding: 24px 12px;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
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

function schemeTheme(): 'default' | 'dark' {
  return document.documentElement.getAttribute('data-color-scheme') === 'light'
    ? 'default'
    : 'dark';
}

async function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').catch(err => {
      mermaidReady = null;
      throw err;
    });
  }
  const mod = await mermaidReady;
  const theme = schemeTheme();
  if (theme !== lastTheme) {
    mod.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      fontFamily: 'inherit',
    });
    lastTheme = theme;
  }
  return mod.default;
}

function MermaidViewport({ svg }: { svg: string }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      setScale(current => Math.min(4, Math.max(0.35, current * factor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={frame}
      className="mermaid-block__diagram"
      onPointerDown={event => {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        drag.current = { x: pos.x, y: pos.y, px: event.clientX, py: event.clientY };
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start) return;
        setPos({
          x: start.x + (event.clientX - start.px),
          y: start.y + (event.clientY - start.py),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <div
        className="mermaid-block__stage"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function MermaidRenderer({ code }: CodeBlockRendererProps) {
  const [copied, setCopied] = useState(false);
  const [liveHint, setLiveHint] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [full, setFull] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      lastTheme = null;
      setThemeTick(n => n + 1);
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-color-scheme', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    const source = code.trim();
    if (!source) {
      setError('Empty mermaid block');
      return;
    }

    void (async () => {
      try {
        const mermaid = await getMermaid();
        // parse() throws with the lexer line; suppressErrors hid that as
        // "Invalid mermaid syntax" (reserved ids like `graph` look empty).
        await mermaid.parse(source);
        if (cancelled) return;
        const id = `dnx-mmd-${++renderSeq}`;
        const result = await mermaid.render(id, source);
        if (cancelled) return;
        setSvg(result.svg);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, themeTick]);

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

  const copyForLive = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setLiveHint(true);
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
      liveTimeoutRef.current = setTimeout(() => setLiveHint(false), 3000);
    } catch {
      // clipboard can fail in locked sessions
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
          <button
            className="mermaid-block__btn"
            onClick={() => setShowSource(v => !v)}
            type="button"
          >
            {showSource ? 'Hide source' : 'Source'}
          </button>
          <button className="mermaid-block__btn" onClick={copySource} type="button">
            Copy
          </button>
          <button className="mermaid-block__btn" onClick={copyForLive} type="button">
            Copy for Mermaid Live
          </button>
          {svg && !error ? (
            <button
              className="mermaid-block__btn"
              onClick={() => setFull(open => !open)}
              type="button"
            >
              {full ? 'Close' : 'Expand'}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <div className="mermaid-block__error">{error}</div> : null}
      {svg && !error ? <MermaidViewport svg={svg} /> : null}
      {full && svg && !error
        ? createPortal(
            <>
              <div className="mermaid-block__scrim" onClick={() => setFull(false)} />
              <div className="mermaid-block mermaid-block--full">
                <div className="mermaid-block__header">
                  <span className="mermaid-block__label">Mermaid Diagram</span>
                  <button
                    className="mermaid-block__btn"
                    onClick={() => setFull(false)}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <MermaidViewport svg={svg} />
              </div>
            </>,
            document.body
          )
        : null}
      {!svg && !error ? <div className="mermaid-block__placeholder">Rendering…</div> : null}
      {showSource || error ? <div className="mermaid-block__code">{code}</div> : null}
    </div>
  );
}

export const mermaidPlugin: PluginManifest = {
  id: 'dripnex-mermaid',
  name: 'Mermaid Diagrams',
  version: '1.2.0',
  description: 'Renders mermaid code blocks as SVG diagrams in preview',

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
