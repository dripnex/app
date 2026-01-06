import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Folder, ChevronRight, X } from 'lucide-react';
import { useNotebookTree, getNotebookPath } from '../../hooks/useNotebooks';

interface SidebarBreadcrumbProps {
  readonly selectedNotebookId: string | null;
  readonly tagFilter: string | null;
  readonly onNavigate: (id: string | null) => void;
  readonly onClearTagFilter: () => void;
}

/**
 * Simple hook to get the previous value of a variable.
 */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/**
 * Check if user prefers reduced motion (accessibility).
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

type BreadcrumbState = 'hidden' | 'entering' | 'visible' | 'exiting';

/**
 * State machine for breadcrumb container visibility.
 * Handles show/hide animations for the entire breadcrumb.
 */
function useBreadcrumbVisibility(hasContent: boolean) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const prevHasContent = usePrevious(hasContent);

  const [state, setState] = useState<BreadcrumbState>(() => {
    if (!hasContent) return 'hidden';
    return prefersReducedMotion ? 'visible' : 'entering';
  });

  useEffect(() => {
    if (prefersReducedMotion) {
      setState(hasContent ? 'visible' : 'hidden');
      return;
    }

    // Content appeared: hidden → entering
    if (hasContent && !prevHasContent) {
      setState('entering');
    }
    // Content disappeared: visible → exiting
    else if (!hasContent && prevHasContent) {
      setState('exiting');
    }
  }, [hasContent, prevHasContent, prefersReducedMotion]);

  const handleAnimationEnd = useCallback(() => {
    setState(current => {
      if (current === 'entering') return 'visible';
      if (current === 'exiting') return 'hidden';
      return current;
    });
  }, []);

  return { state, handleAnimationEnd };
}

interface SegmentData {
  id: string;
  name: string;
}

interface SegmentState extends SegmentData {
  status: 'stable' | 'entering';
}

interface ExitingSegment extends SegmentData {
  status: 'exiting';
}

/**
 * Hook for segment-level animations.
 * Tracks which segments are stable, entering, or exiting.
 */
function useSegmentTransition(path: SegmentData[]) {
  const prevPath = usePrevious(path);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [exitingSegments, setExitingSegments] = useState<ExitingSegment[]>([]);

  // Find common prefix length between current and previous path
  const commonPrefixLength = useMemo(() => {
    if (!prevPath || prevPath.length === 0) return 0;
    let i = 0;
    while (i < path.length && i < prevPath.length && path[i]?.id === prevPath[i]?.id) {
      i++;
    }
    return i;
  }, [path, prevPath]);

  // Calculate segment states
  const segments = useMemo((): SegmentState[] => {
    // If reduced motion or no previous path, all segments are stable
    if (prefersReducedMotion || !prevPath || prevPath.length === 0) {
      return path.map(item => ({
        id: item.id,
        name: item.name,
        status: 'stable' as const,
      }));
    }

    return path.map((item, i) => ({
      id: item.id,
      name: item.name,
      status: i < commonPrefixLength ? ('stable' as const) : ('entering' as const),
    }));
  }, [path, prevPath, commonPrefixLength, prefersReducedMotion]);

  // Handle exiting segments
  useEffect(() => {
    if (prefersReducedMotion || !prevPath || prevPath.length === 0) return;

    // Segments after common prefix are exiting
    const exiting = prevPath.slice(commonPrefixLength).map(item => ({
      id: item.id,
      name: item.name,
      status: 'exiting' as const,
    }));

    if (exiting.length > 0) {
      setExitingSegments(exiting);
      // Clear after animation completes
      const timer = setTimeout(() => setExitingSegments([]), 150);
      return () => clearTimeout(timer);
    }
  }, [path, prevPath, commonPrefixLength, prefersReducedMotion]);

  return { segments, exitingSegments, commonPrefixLength };
}

export function SidebarBreadcrumb({
  selectedNotebookId,
  tagFilter,
  onNavigate,
  onClearTagFilter,
}: SidebarBreadcrumbProps) {
  const { data: tree } = useNotebookTree();

  const path = useMemo(
    () => getNotebookPath(selectedNotebookId, tree ?? []),
    [selectedNotebookId, tree]
  );

  const hasNotebookPath = selectedNotebookId && path.length > 0;
  const hasContent = hasNotebookPath || !!tagFilter;

  const { state, handleAnimationEnd } = useBreadcrumbVisibility(hasContent);
  const { segments, exitingSegments, commonPrefixLength } = useSegmentTransition(path);

  const handleRootClick = useCallback(() => {
    onNavigate(null);
  }, [onNavigate]);

  const handleItemClick = useCallback(
    (id: string) => {
      onNavigate(id);
    },
    [onNavigate]
  );

  // Hide completely when in hidden state
  if (state === 'hidden') {
    return null;
  }

  // Container animation class (for initial show/final hide)
  const containerClass =
    state === 'entering'
      ? 'sidebar-breadcrumb-content--entering'
      : state === 'exiting'
        ? 'sidebar-breadcrumb-content--exiting'
        : '';

  return (
    <nav className="sidebar-breadcrumb" aria-label="Notebook path">
      <div
        className={`sidebar-breadcrumb-content ${containerClass}`}
        onAnimationEnd={handleAnimationEnd}
      >
        {hasNotebookPath && (
          <>
            <button
              type="button"
              className="sidebar-breadcrumb-icon"
              onClick={handleRootClick}
              aria-label="Go to all notebooks"
            >
              <Folder size={14} aria-hidden="true" />
            </button>

            {/* Exiting segments (rendered first, positioned absolute) */}
            {exitingSegments.map((seg, index) => (
              <span
                key={`exit-${seg.id}`}
                className="sidebar-breadcrumb-segment segment--exiting"
                style={{ '--segment-index': commonPrefixLength + index } as React.CSSProperties}
              >
                <ChevronRight
                  size={10}
                  className="sidebar-breadcrumb-separator"
                  aria-hidden="true"
                />
                <span className="sidebar-breadcrumb-item">{seg.name}</span>
              </span>
            ))}

            {/* Current segments (stable + entering) */}
            {segments.map((seg, index) => {
              const isLast = index === segments.length - 1 && !tagFilter;

              return (
                <span
                  key={seg.id}
                  className={`sidebar-breadcrumb-segment ${seg.status === 'entering' ? 'segment--entering' : ''}`}
                >
                  <ChevronRight
                    size={10}
                    className="sidebar-breadcrumb-separator"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className={`sidebar-breadcrumb-item ${isLast ? 'current' : ''}`}
                    onClick={() => handleItemClick(seg.id)}
                    aria-current={isLast ? 'location' : undefined}
                  >
                    {seg.name}
                  </button>
                </span>
              );
            })}
          </>
        )}

        {tagFilter && (
          <span className="sidebar-breadcrumb-segment">
            {hasNotebookPath && (
              <ChevronRight size={10} className="sidebar-breadcrumb-separator" aria-hidden="true" />
            )}
            <span className="sidebar-breadcrumb-tag">
              <span className="sidebar-breadcrumb-tag-name">#{tagFilter}</span>
              <button
                type="button"
                className="sidebar-breadcrumb-tag-clear"
                onClick={onClearTagFilter}
                aria-label={`Clear tag filter: ${tagFilter}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          </span>
        )}
      </div>
    </nav>
  );
}
