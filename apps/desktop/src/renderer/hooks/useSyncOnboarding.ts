/**
 * Sync Onboarding Hook
 *
 * Determines whether to show the "Enable Sync" prompt.
 * Shows the prompt when the user has created 5+ notes and either:
 * - Is not authenticated, OR
 * - Is authenticated but on free/expired plan (needs to subscribe)
 *
 * Dismissal is per-session only (React state) — the prompt will
 * reappear on the next app launch so the user gets a gentle reminder
 * without being nagged within a single session.
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useLicense } from '../contexts/LicenseContext';
import { useNoteCounts } from './useNotes';

const NOTE_THRESHOLD = 5;

const SYNC_CAPABLE_STATUSES = ['trial', 'pro_active', 'pro_grace'];

export function useSyncOnboarding() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const { state: licenseState } = useLicense();
  const { data: counts } = useNoteCounts();
  const [dismissed, setDismissed] = useState(false);

  const totalNotes = (counts as { active?: number })?.active ?? 0;

  // User has sync fully working: authenticated AND on a sync-capable plan
  const hasSyncWorking =
    isAuthenticated && licenseState != null && SYNC_CAPABLE_STATUSES.includes(licenseState.status);

  const shouldShowPrompt = !hasSyncWorking && !dismissed && totalNotes >= NOTE_THRESHOLD;

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
  }, []);

  return { shouldShowPrompt, dismissPrompt, totalNotes };
}
