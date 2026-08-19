import { useCallback, useEffect, useRef, useState } from 'react';

export interface WikilinkPeekRequest {
  target: string;
  x: number;
  y: number;
}

const SHOW_MS = 380;
const HIDE_MS = 140;

export function useWikilinkPeek() {
  const [peek, setPeek] = useState<WikilinkPeekRequest | null>(null);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);
  const pendingTarget = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  const request = useCallback((target: string, x: number, y: number) => {
    window.clearTimeout(hideTimer.current);
    if (pendingTarget.current === target) return;
    setPeek(current => {
      if (current?.target === target) return current;
      pendingTarget.current = target;
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => {
        pendingTarget.current = null;
        setPeek({ target, x, y });
      }, SHOW_MS);
      return current;
    });
  }, []);

  const leave = useCallback(() => {
    pendingTarget.current = null;
    window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => setPeek(null), HIDE_MS);
  }, []);

  const hold = useCallback(() => {
    window.clearTimeout(hideTimer.current);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setPeek(null);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { peek, request, leave, hold, close };
}
