import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Semantic visibility flags for toolbar groups.
 * Each flag indicates whether that group should be visible.
 */
export interface ToolbarVisibility {
  /** H2, Bold, Italic, Strikethrough, Code, Link */
  readonly text: boolean;
  /** Bullet List, Numbered List, Checkbox */
  readonly lists: boolean;
  /** Quote, Code Block, Horizontal Rule */
  readonly blocks: boolean;
  /** Undo, Redo */
  readonly history: boolean;
}

interface UseToolbarOverflowOptions {
  /** Ref to the toolbar container element */
  readonly toolbarRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to the parent container (for measuring available width) */
  readonly containerRef?: React.RefObject<HTMLDivElement | null>;
}

interface UseToolbarOverflowResult {
  /** Current visibility state for each toolbar group */
  readonly visibility: ToolbarVisibility;
  /** Whether any groups are hidden (overflow detected) */
  readonly hasOverflow: boolean;
}

/**
 * Breakpoints for toolbar width.
 * Set to 0 to always show all groups - CSS flex-wrap handles the layout.
 */
const BREAKPOINTS = {
  SHOW_ALL: 0,
  SHOW_BLOCKS: 0,
  SHOW_LISTS: 0,
} as const;

/**
 * Hook to manage toolbar overflow based on container width.
 *
 * Uses ResizeObserver to monitor toolbar width and determines
 * which button groups should be visible.
 *
 * Following useScrollSync.ts pattern for cleanup.
 */
export function useToolbarOverflow({
  toolbarRef,
  containerRef,
}: UseToolbarOverflowOptions): UseToolbarOverflowResult {
  const [visibility, setVisibility] = useState<ToolbarVisibility>({
    text: true,
    lists: true,
    blocks: true,
    history: true,
  });

  const observerRef = useRef<ResizeObserver | null>(null);

  /**
   * Calculate visibility based on toolbar width.
   * Returns semantic flags instead of numeric group count.
   */
  const calculateVisibility = useCallback((width: number): ToolbarVisibility => {
    if (width >= BREAKPOINTS.SHOW_ALL) {
      return { text: true, lists: true, blocks: true, history: true };
    }
    if (width >= BREAKPOINTS.SHOW_BLOCKS) {
      return { text: true, lists: true, blocks: true, history: false };
    }
    if (width >= BREAKPOINTS.SHOW_LISTS) {
      return { text: true, lists: true, blocks: false, history: false };
    }
    // Smallest width: only text formatting visible
    return { text: true, lists: false, blocks: false, history: false };
  }, []);

  /**
   * Check available width and update visibility state.
   * Uses containerRef if provided, otherwise falls back to toolbarRef.
   */
  const checkOverflow = useCallback(() => {
    // Use container for measuring available width (if provided)
    const measureElement = containerRef?.current || toolbarRef.current;
    if (!measureElement) return;

    const width = measureElement.getBoundingClientRect().width;
    const newVisibility = calculateVisibility(width);

    setVisibility(prev => {
      // Only update if changed to prevent unnecessary re-renders
      if (
        prev.text !== newVisibility.text ||
        prev.lists !== newVisibility.lists ||
        prev.blocks !== newVisibility.blocks ||
        prev.history !== newVisibility.history
      ) {
        return newVisibility;
      }
      return prev;
    });
  }, [containerRef, toolbarRef, calculateVisibility]);

  useEffect(() => {
    // Observe the container (for available width) or toolbar as fallback
    const elementToObserve = containerRef?.current || toolbarRef.current;
    if (!elementToObserve) return;

    // Initial check
    checkOverflow();

    // Create ResizeObserver
    observerRef.current = new ResizeObserver(checkOverflow);
    observerRef.current.observe(elementToObserve);

    return () => {
      // Cleanup following useScrollSync.ts pattern
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [containerRef, toolbarRef, checkOverflow]);

  // Derive hasOverflow from visibility state
  const hasOverflow = !visibility.lists || !visibility.blocks || !visibility.history;

  return { visibility, hasOverflow };
}
