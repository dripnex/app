import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'readied:layout';

interface LayoutState {
  sidebarWidth: number;
  notelistWidth: number;
}

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 220,
  notelistWidth: 280,
};

const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 350;
const MIN_NOTELIST = 220;
const MAX_NOTELIST = 500;

/**
 * Hook for managing resizable panel widths with localStorage persistence
 */
export function useResizableLayout() {
  const [layout, setLayout] = useState<LayoutState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          sidebarWidth: clamp(
            parsed.sidebarWidth ?? DEFAULT_LAYOUT.sidebarWidth,
            MIN_SIDEBAR,
            MAX_SIDEBAR
          ),
          notelistWidth: clamp(
            parsed.notelistWidth ?? DEFAULT_LAYOUT.notelistWidth,
            MIN_NOTELIST,
            MAX_NOTELIST
          ),
        };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_LAYOUT;
  });

  // Save to localStorage when layout changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  // Resize state
  const resizingRef = useRef<'sidebar' | 'notelist' | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;

    const delta = e.clientX - startXRef.current;
    const newWidth = startWidthRef.current + delta;

    if (resizingRef.current === 'sidebar') {
      setLayout(prev => ({
        ...prev,
        sidebarWidth: clamp(newWidth, MIN_SIDEBAR, MAX_SIDEBAR),
      }));
    } else {
      setLayout(prev => ({
        ...prev,
        notelistWidth: clamp(newWidth, MIN_NOTELIST, MAX_NOTELIST),
      }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Attach/detach global listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startResizeSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = 'sidebar';
      startXRef.current = e.clientX;
      startWidthRef.current = layout.sidebarWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [layout.sidebarWidth]
  );

  const startResizeNotelist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = 'notelist';
      startXRef.current = e.clientX;
      startWidthRef.current = layout.notelistWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [layout.notelistWidth]
  );

  return {
    sidebarWidth: layout.sidebarWidth,
    notelistWidth: layout.notelistWidth,
    startResizeSidebar,
    startResizeNotelist,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
