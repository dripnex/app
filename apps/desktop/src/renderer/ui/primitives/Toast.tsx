/**
 * Toast — Design system primitive
 *
 * Renders toast notifications from the toast store.
 * Place <Toaster /> once in your app root.
 */

import { useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { playMotion } from '../../motion/gsapRuntime';
import { useToastStore, type ToastItem } from './toastStore';
import styles from './Toast.module.css';

// ============================================================================
// Single Toast
// ============================================================================

function ToastNotification({ item }: { item: ToastItem }) {
  const dismissToast = useToastStore(s => s.dismissToast);
  const ref = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const dismiss = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    playMotion('toast-out', ref.current, { onComplete: () => dismissToast(item.id) });
  }, [item.id, dismissToast]);

  useLayoutEffect(() => {
    playMotion('toast-in', ref.current);
  }, []);

  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = setTimeout(dismiss, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, dismiss]);

  const cls = [styles.toast, styles[item.type]].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      className={cls}
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
    >
      <span className={styles.dot} />
      <span className={styles.message}>{item.message}</span>
      <button className={styles.dismiss} onClick={dismiss} aria-label="Dismiss notification">
        &times;
      </button>
    </div>
  );
}

// ============================================================================
// Toaster Container
// ============================================================================

export function Toaster() {
  const toasts = useToastStore(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map(item => (
        <ToastNotification key={item.id} item={item} />
      ))}
    </div>
  );
}
