/**
 * Toast Store — Zustand store powering the toast notification system
 *
 * Usage:
 *   import { toast } from '@/ui/primitives';
 *   toast.success('Saved');
 *   toast.error('Something went wrong');
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
}

// ============================================================================
// Store
// ============================================================================

let nextId = 0;

export const useToastStore = create<ToastState>(set => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = `toast-${++nextId}-${Date.now()}`;
    const item: ToastItem = { id, message, type, duration };
    set(state => ({ toasts: [...state.toasts, item] }));
  },

  dismissToast: id => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));

// ============================================================================
// Convenience API
// ============================================================================

export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'success', duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'error', duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'info', duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'warning', duration),
};
