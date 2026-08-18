import {
  useMemo,
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { Clock, CalendarPlus, ListChecks } from 'lucide-react';
import { scanMarkdown } from '@dripnex/markdown';
import { coreRemarkPlugins } from '../../lib/coreRemarkPlugins';
import {
  remarkPluginStore,
  rehypePluginStore,
  previewComponentStore,
  codeBlockStore,
} from '@dripnex/plugin-api';
import { formatDateTime } from '../../utils/date';
import { useEditorBufferStore, selectContentForNote } from '../../stores/editorBufferStore';
import { usePreviewFindStore } from '../../stores/previewFindStore';
import { applyPreviewFind, unwrapPreviewFindMarks } from '../../utils/previewFind';
import { PreviewFindBar } from './PreviewFindBar';
import { cssm } from '../../lib/cssm';
import styles from './MarkdownPreview.module.css';

const sc = cssm(styles);

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface MarkdownPreviewProps {
  readonly content: string;
  readonly noteId: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly onReady?: () => void;
  readonly onWikilinkClick?: (target: string, anchor?: string) => void;
  readonly onEmbedClick?: (target: string, url: string) => void;
  /** Optional pre-resolved embeds from parent (for sharing with editor) */
  readonly resolvedEmbeds?: Record<string, string | null>;
}

/** Imperative handle for scroll sync */
export interface MarkdownPreviewHandle {
  getScrollFraction: () => number;
  setScrollFraction: (fraction: number) => void;
  onScroll: (callback: (fraction: number) => void) => () => void;
  canScroll: () => boolean;
  jumpToHeading: (text: string) => void;
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      content: contentProp,
      noteId,
      createdAt,
      updatedAt,
      onReady,
      onWikilinkClick,
      onEmbedClick,
      resolvedEmbeds: resolvedEmbedsProp,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [internalResolvedEmbeds, setInternalResolvedEmbeds] = useState<
      Record<string, string | null>
    >({});
    const [findCount, setFindCount] = useState(0);
    const findOpen = usePreviewFindStore(s => s.open);
    const findQuery = usePreviewFindStore(s => s.query);
    const findIndex = usePreviewFindStore(s => s.index);

    // Subscribe to plugin preview stores
    const pluginRemarkRegs = useSyncExternalStore(
      remarkPluginStore.subscribe,
      () => remarkPluginStore.getState().registrations
    );
    const pluginRehypeRegs = useSyncExternalStore(
      rehypePluginStore.subscribe,
      () => rehypePluginStore.getState().registrations
    );
    const pluginComponentRegs = useSyncExternalStore(
      previewComponentStore.subscribe,
      () => previewComponentStore.getState().registrations
    );
    const pluginCodeBlockRegs = useSyncExternalStore(
      codeBlockStore.subscribe,
      () => codeBlockStore.getState().registrations
    );

    // SECURITY: rehypeRaw parses raw HTML embedded in note markdown, so the
    // output must be sanitized before rendering (defends against XSS via
    // <script>, event handlers, javascript: URLs, etc.). The schema extends the
    // GitHub-flavored default to preserve app features: the custom <embed-image>
    // element, task-list checkboxes, className/data-* (wikilinks, syntax
    // highlight), asset:// image URLs, and plugin-registered preview elements.
    // Runs BEFORE rehypeHighlight so highlight's generated spans/classes are
    // trusted output rather than sanitized input.
    const sanitizeSchema = useMemo(() => {
      const base = defaultSchema;
      const attrs = base.attributes ?? {};
      const star = (attrs['*'] ?? []) as unknown[];
      return {
        ...base,
        tagNames: [
          ...(base.tagNames ?? []),
          'embed-image',
          'mark',
          ...pluginComponentRegs.map(r => r.tagName),
        ],
        attributes: {
          ...attrs,
          '*': [...star, 'className', 'data*'],
          'embed-image': ['src', 'alt', 'className', 'loading'],
          input: ['type', 'checked', 'disabled'],
        },
        protocols: {
          ...base.protocols,
          // Local embeds are resolved to asset:// URLs before rendering.
          src: [...(base.protocols?.src ?? []), 'asset'],
        },
      } as typeof defaultSchema;
    }, [pluginComponentRegs]);

    // Use live buffer content if available for this note, otherwise fall back to prop
    const liveContent = useEditorBufferStore(selectContentForNote(noteId));
    const content = liveContent ?? contentProp;
    const scan = useMemo(() => scanMarkdown(content), [content]);

    // Use prop if provided, otherwise internal state
    const resolvedEmbeds = resolvedEmbedsProp ?? internalResolvedEmbeds;

    // Resolve embeds via IPC (only if not using prop)
    useEffect(() => {
      // Skip if parent is managing resolved embeds
      if (resolvedEmbedsProp !== undefined) return;

      const targets = scan.embedTargets;
      if (targets.length === 0) {
        setInternalResolvedEmbeds({});
        return;
      }
      void window.dripnex.embeds.resolveBatch(targets, noteId).then(result => {
        setInternalResolvedEmbeds(result);
      });
    }, [scan.embedTargets, noteId, resolvedEmbedsProp]);

    // Invariant:
    // Never normalize embeds to markdown images until all URLs are resolved.
    // Violating this produces <img src=""> and broken previews.
    const resolvedContent = useMemo(() => {
      const targets = scan.embedTargets;
      if (targets.length === 0) return content;

      // Check if all LOCAL targets are resolved (external URLs don't need IPC)
      const localTargets = targets.filter(
        t => !t.startsWith('http://') && !t.startsWith('https://')
      );
      const allLocalResolved =
        localTargets.length === 0 || localTargets.every(t => resolvedEmbeds[t] != null);

      if (!allLocalResolved) {
        return content; // Wait for IPC to resolve local files
      }

      let result = content;
      for (const target of targets) {
        // External URLs use themselves, local files use resolved asset:// URL
        const isExternal = target.startsWith('http://') || target.startsWith('https://');
        const url = isExternal ? target : resolvedEmbeds[target];

        if (!url) continue;

        const pattern = new RegExp(`!\\[\\[${escapeRegex(target)}(?:\\|([^\\]]+))?\\]\\]`, 'g');
        // Use custom HTML element to bypass rehype URL sanitization
        result = result.replace(
          pattern,
          (_, display) => `<embed-image src="${url}" alt="${display || target}"></embed-image>`
        );
      }
      return result;
    }, [content, resolvedEmbeds, scan.embedTargets]);

    // Click handler for wikilinks and embeds
    const handleClick = (e: React.MouseEvent) => {
      const wikilinkEl = (e.target as HTMLElement).closest('.wikilink');
      if (wikilinkEl) {
        const noteTitle = wikilinkEl.getAttribute('data-target');
        const anchor = wikilinkEl.getAttribute('data-anchor') ?? undefined;
        if (noteTitle && onWikilinkClick) {
          e.preventDefault();
          onWikilinkClick(noteTitle, anchor);
        }
        return;
      }

      const imgEl = e.target as HTMLElement;
      if (imgEl.tagName === 'IMG') {
        const src = imgEl.getAttribute('src');
        if (src?.startsWith('asset://') && onEmbedClick) {
          e.preventDefault();
          onEmbedClick(src, src);
        }
      }
    };

    useEffect(() => {
      onReady?.();
    }, []);

    useImperativeHandle(ref, () => ({
      getScrollFraction: () => {
        const el = containerRef.current;
        if (!el) return 0;
        const maxScroll = el.scrollHeight - el.clientHeight;
        return maxScroll > 0 ? el.scrollTop / maxScroll : 0;
      },
      setScrollFraction: (fraction: number) => {
        const el = containerRef.current;
        if (!el) return;
        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollTop = fraction * maxScroll;
      },
      onScroll: (callback: (fraction: number) => void) => {
        const el = containerRef.current;
        if (!el) return () => {};
        const handler = () => {
          const maxScroll = el.scrollHeight - el.clientHeight;
          const fraction = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
          callback(fraction);
        };
        el.addEventListener('scroll', handler);
        return () => el.removeEventListener('scroll', handler);
      },
      canScroll: () => {
        const el = containerRef.current;
        if (!el) return false;
        return el.scrollHeight > el.clientHeight + 1;
      },
      jumpToHeading: (text: string) => {
        const el = containerRef.current;
        if (!el) return;
        const headings = el.querySelectorAll('h1,h2,h3,h4,h5,h6');
        const target = Array.from(headings).find(h => (h.textContent ?? '').trim() === text);
        target?.scrollIntoView({ block: 'start' });
      },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      if (!findOpen) {
        unwrapPreviewFindMarks(el);
        setFindCount(0);
        return;
      }
      setFindCount(applyPreviewFind(el, findQuery, findIndex));
    }, [content, findOpen, findQuery, findIndex]);

    const tasks = scan.tasks;
    const hasProgress = tasks.total > 0;
    const progressPercent = hasProgress ? (tasks.completed / tasks.total) * 100 : 0;

    return (
      <div className={sc('preview-shell')}>
        {findOpen ? <PreviewFindBar matchCount={findCount} /> : null}
      <div ref={containerRef} className={sc('markdown-preview')} data-preview onClick={handleClick}>
        <div className={sc('preview-metadata-header')}>
          {hasProgress && (
            <div className={sc('preview-meta-item')}>
              <ListChecks size={12} className={sc('preview-meta-icon')} aria-hidden="true" />
              <div className={sc('preview-meta-content')}>
                <span className={sc('preview-meta-label')}>PROGRESS</span>
                <div className={sc('preview-meta-progress')}>
                  <div className={sc('preview-progress-bar')}>
                    <div
                      className={sc('preview-progress-fill')}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className={sc('preview-progress-text')}>
                    {tasks.completed} of {tasks.total} tasks
                  </span>
                </div>
              </div>
            </div>
          )}

          {createdAt && (
            <div className={sc('preview-meta-item')}>
              <Clock size={12} className={sc('preview-meta-icon')} aria-hidden="true" />
              <div className={sc('preview-meta-content')}>
                <span className={sc('preview-meta-label')}>CREATED AT</span>
                <span className={sc('preview-meta-value')}>{formatDateTime(createdAt)}</span>
              </div>
            </div>
          )}

          {updatedAt && (
            <div className={sc('preview-meta-item')}>
              <CalendarPlus size={12} className={sc('preview-meta-icon')} aria-hidden="true" />
              <div className={sc('preview-meta-content')}>
                <span className={sc('preview-meta-label')}>UPDATED AT</span>
                <span className={sc('preview-meta-value')}>{formatDateTime(updatedAt)}</span>
              </div>
            </div>
          )}
        </div>

        <Markdown
          remarkPlugins={
            [
              ...coreRemarkPlugins(),
              ...pluginRemarkRegs.map(r => r.plugin),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any[]
          }
          rehypePlugins={
            [
              rehypeRaw,
              [rehypeSanitize, sanitizeSchema],
              rehypeHighlight,
              ...pluginRehypeRegs.map(r => r.plugin),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any[]
          }
          components={
            {
              input: ({ type, checked, ...props }) => {
                if (type === 'checkbox') {
                  return <input type="checkbox" checked={checked} disabled {...props} />;
                }
                return <input type={type} {...props} />;
              },
              // Custom embed-image element bypasses rehype URL sanitization
              'embed-image': ({ src, alt }: { src?: string; alt?: string }) => (
                <img src={src} alt={alt} className={sc('embed', 'embed-image')} loading="lazy" />
              ),
              // Code block renderer delegation to plugins
              code: ({ className, children, ...props }) => {
                const match = /language-([\w+#.-]+)/.exec(className || '');
                const lang = match?.[1];
                if (lang) {
                  const reg = pluginCodeBlockRegs.find(r => r.language === lang);
                  if (reg) {
                    const CodeRenderer = reg.component;
                    const code = String(children).replace(/\n$/, '');
                    return <CodeRenderer code={code} language={lang} />;
                  }
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              // Plugin-registered preview components
              ...Object.fromEntries(pluginComponentRegs.map(r => [r.tagName, r.component])),
            } as Record<string, React.ComponentType<unknown>>
          }
        >
          {resolvedContent}
        </Markdown>
      </div>
      </div>
    );
  }
);
