/**
 * Toast — Design system primitive
 *
 * Renders toast notifications from the toast store.
 * Place <Toaster /> once in your app root.
 */

import { useEffect, useCallback, useState } from 'react';
import { useToastStore, type ToastItem } from './toastStore';
import styles from './Toast.module.css';

// ============================================================================
// Single Toast
// ============================================================================

function ToastNotification({ item }: { item: ToastItem }) {
  const dismissToast = useToastStore(s => s.dismissToast);
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    // Wait for exit animation before removing from store
    setTimeout(() => dismissToast(item.id), 150);
  }, [item.id, dismissToast]);

  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = setTimeout(dismiss, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, dismiss]);

  const cls = [styles.toast, styles[item.type], exiting ? styles.exiting : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
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
