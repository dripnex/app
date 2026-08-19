import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ensurePluginComponentStyles } from './styles.js';

export interface PluginModalProps {
  visible: boolean;
  children: ReactNode;
  className?: string;
  large?: boolean;
  onBackdropClick?: () => void;
  onEscKeyDown?: () => void;
  autofocus?: boolean;
}

export function Modal({
  visible,
  children,
  className,
  large,
  onBackdropClick,
  onEscKeyDown,
  autofocus = true,
}: PluginModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ensurePluginComponentStyles();
  }, []);

  useEffect(() => {
    if (!visible) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    if (autofocus) panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscKeyDown?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocus.current?.focus?.();
    };
  }, [visible, autofocus, onEscKeyDown]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="dripnex-plugin-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
    >
      <div
        ref={panelRef}
        className={[
          'dripnex-plugin-modal',
          large ? 'dripnex-plugin-modal--large' : '',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
