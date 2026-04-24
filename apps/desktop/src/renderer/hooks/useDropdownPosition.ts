import { useLayoutEffect, useState, RefObject } from 'react';

interface DropdownPosition {
  top: string;
  bottom: string;
  left: string;
  right: string;
  transformOrigin: string;
}

interface UseDropdownPositionOptions {
  triggerRef: RefObject<HTMLElement | null>;
  menuRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  /** Padding from viewport edge in pixels */
  viewportPadding?: number;
}

/**
 * Hook to calculate optimal dropdown position
 * Auto-flips when near viewport edges
 */
export function useDropdownPosition({
  triggerRef,
  menuRef,
  isOpen,
  viewportPadding = 8,
}: UseDropdownPositionOptions): DropdownPosition {
  const [position, setPosition] = useState<DropdownPosition>({
    top: '100%',
    bottom: 'auto',
    left: '0',
    right: 'auto',
    transformOrigin: 'top left',
  });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !menuRef.current) return;

    const trigger = triggerRef.current;
    const menu = menuRef.current;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if menu would overflow bottom
    const wouldOverflowBottom =
      triggerRect.bottom + menuRect.height + viewportPadding > viewportHeight;

    // Check if menu would overflow right
    const wouldOverflowRight = triggerRect.left + menuRect.width + viewportPadding > viewportWidth;

    // Check if there's enough space above
    const hasSpaceAbove = triggerRect.top - menuRect.height - viewportPadding > 0;

    // Check if there's enough space to the left
    const hasSpaceLeft = triggerRect.right - menuRect.width - viewportPadding > 0;

    // Determine vertical position
    const flipVertical = wouldOverflowBottom && hasSpaceAbove;

    // Determine horizontal position
    const flipHorizontal = wouldOverflowRight && hasSpaceLeft;

    setPosition({
      top: flipVertical ? 'auto' : '100%',
      bottom: flipVertical ? '100%' : 'auto',
      left: flipHorizontal ? 'auto' : '0',
      right: flipHorizontal ? '0' : 'auto',
      transformOrigin: `${flipVertical ? 'bottom' : 'top'} ${flipHorizontal ? 'right' : 'left'}`,
    });
  }, [isOpen, triggerRef, menuRef, viewportPadding]);

  return position;
}
