/**
 * Sync Onboarding Hook
 *
 * Determines whether to show the "Enable Sync" prompt.
 * Shows the prompt when the user has created 3+ notes and hasn't
 * dismissed it or already authenticated.
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNoteCounts } from './useNotes';

const DISMISSED_KEY = 'readied:sync-onboarding-dismissed';
const NOTE_THRESHOLD = 3;

export function useSyncOnboarding() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const { data: counts } = useNoteCounts();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');

  const totalNotes = (counts as { active?: number })?.active ?? 0;

  const shouldShowPrompt = !isAuthenticated && !dismissed && totalNotes >= NOTE_THRESHOLD;

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }, []);

  return { shouldShowPrompt, dismissPrompt, totalNotes };
}
