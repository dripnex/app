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
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import '../../styles/code-highlight.css';
import { Clock, CalendarPlus, ListChecks } from 'lucide-react';
import { remarkWikilink } from '@readied/wikilinks';
import { extractEmbedTargets } from '@readied/embeds';
import { countMarkdownTasks } from '@readied/tasks';
import {
  remarkPluginStore,
  rehypePluginStore,
  previewComponentStore,
  codeBlockStore,
} from '@readied/plugin-api';
import { formatDateTime } from '../../utils/date';
import { useEditorBufferStore, selectContentForNote } from '../../stores/editorBufferStore';

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

    // Use live buffer content if available for this note, otherwise fall back to prop
    const liveContent = useEditorBufferStore(selectContentForNote(noteId));
    const content = liveContent ?? contentProp;

    // Use prop if provided, otherwise internal state
    const resolvedEmbeds = resolvedEmbedsProp ?? internalResolvedEmbeds;

    // Resolve embeds via IPC (only if not using prop)
    useEffect(() => {
      // Skip if parent is managing resolved embeds
      if (resolvedEmbedsProp !== undefined) return;

      const targets = extractEmbedTargets(content);
      if (targets.length === 0) {
        setInternalResolvedEmbeds({});
        return;
      }
      void window.readied.embeds.resolveBatch(targets, noteId).then(result => {
        setInternalResolvedEmbeds(result);
      });
    }, [content, noteId, resolvedEmbedsProp]);

    // Invariant:
    // Never normalize embeds to markdown images until all URLs are resolved.
    // Violating this produces <img src=""> and broken previews.
    const resolvedContent = useMemo(() => {
      const targets = extractEmbedTargets(content);
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
    }, [content, resolvedEmbeds]);

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
    }));

    const tasks = useMemo(() => countMarkdownTasks(content), [content]);
    const hasProgress = tasks.total > 0;
    const progressPercent = hasProgress ? (tasks.completed / tasks.total) * 100 : 0;

    return (
      <div ref={containerRef} className="markdown-preview" onClick={handleClick}>
        <div className="preview-metadata-header">
          {hasProgress && (
            <div className="preview-meta-item">
              <ListChecks size={12} className="preview-meta-icon" aria-hidden="true" />
              <div className="preview-meta-content">
                <span className="preview-meta-label">PROGRESS</span>
                <div className="preview-meta-progress">
                  <div className="preview-progress-bar">
                    <div
                      className="preview-progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="preview-progress-text">
                    {tasks.completed} of {tasks.total} tasks
                  </span>
                </div>
              </div>
            </div>
          )}

          {createdAt && (
            <div className="preview-meta-item">
              <Clock size={12} className="preview-meta-icon" aria-hidden="true" />
              <div className="preview-meta-content">
                <span className="preview-meta-label">CREATED AT</span>
                <span className="preview-meta-value">{formatDateTime(createdAt)}</span>
              </div>
            </div>
          )}

          {updatedAt && (
            <div className="preview-meta-item">
              <CalendarPlus size={12} className="preview-meta-icon" aria-hidden="true" />
              <div className="preview-meta-content">
                <span className="preview-meta-label">UPDATED AT</span>
                <span className="preview-meta-value">{formatDateTime(updatedAt)}</span>
              </div>
            </div>
          )}
        </div>

        <Markdown
          remarkPlugins={
            [
              remarkGfm,
              remarkWikilink,
              ...pluginRemarkRegs.map(r => r.plugin),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any[]
          }
          rehypePlugins={
            [
              rehypeRaw,
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
                <img src={src} alt={alt} className="embed embed-image" loading="lazy" />
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
    );
  }
);
