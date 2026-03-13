/**
 * Sync Onboarding Hook
 *
 * Determines whether to show the "Enable Sync" prompt.
 * Shows the prompt when the user has created 5+ notes and hasn't
 * dismissed it or already authenticated.
 *
 * Dismissal is per-session only (React state) — the prompt will
 * reappear on the next app launch so the user gets a gentle reminder
 * without being nagged within a single session.
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNoteCounts } from './useNotes';

const NOTE_THRESHOLD = 5;

export function useSyncOnboarding() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const { data: counts } = useNoteCounts();
  const [dismissed, setDismissed] = useState(false);

  const totalNotes = (counts as { active?: number })?.active ?? 0;

  const shouldShowPrompt = !isAuthenticated && !dismissed && totalNotes >= NOTE_THRESHOLD;

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
  }, []);

  return { shouldShowPrompt, dismissPrompt, totalNotes };
}
