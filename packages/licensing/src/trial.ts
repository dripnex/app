import type { TrialState, StoredTrialData } from './types.js';

/**
 * Trial period in days
 */
export const TRIAL_DURATION_DAYS = 14;

/**
 * Calculates days remaining in trial period
 *
 * @param startDate - Trial start date
 * @param now - Current date (for testing)
 * @returns Number of days remaining (0 if expired)
 */
export function calculateDaysRemaining(startDate: Date, now: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / msPerDay);
  const remaining = TRIAL_DURATION_DAYS - elapsedDays;
  return Math.max(0, remaining);
}

/**
 * Gets the current trial state from stored data
 *
 * @param storedData - Persisted trial data (or null if no trial started)
 * @param now - Current date (for testing)
 * @returns Current trial state
 */
export function getTrialState(
  storedData: StoredTrialData | null,
  now: Date = new Date()
): TrialState | null {
  if (!storedData) {
    return null;
  }

  const startDate = new Date(storedData.startDate);
  if (isNaN(startDate.getTime())) {
    return null;
  }

  const daysRemaining = calculateDaysRemaining(startDate, now);

  return {
    startDate: storedData.startDate,
    daysRemaining,
    isExpired: daysRemaining === 0,
  };
}

/**
 * Creates a new trial starting now
 *
 * @param now - Current date (for testing)
 * @returns New trial data to persist
 */
export function startTrial(now: Date = new Date()): StoredTrialData {
  return {
    startDate: now.toISOString(),
  };
}

/**
 * Checks if trial is currently active
 *
 * @param state - Current trial state
 * @returns True if trial is active (started and not expired)
 */
export function isTrialActive(state: TrialState | null): boolean {
  if (!state) {
    return false;
  }
  return !state.isExpired;
}

/**
 * Checks if trial has expired
 *
 * @param state - Current trial state
 * @returns True if trial has expired
 */
export function isTrialExpired(state: TrialState | null): boolean {
  if (!state) {
    return false; // No trial = not expired (never started)
  }
  return state.isExpired;
}

/**
 * Checks if trial has been started
 *
 * @param storedData - Persisted trial data
 * @returns True if trial has been started
 */
export function hasTrialStarted(storedData: StoredTrialData | null): boolean {
  return storedData !== null;
}

/**
 * Gets trial end date
 *
 * @param startDate - Trial start date
 * @returns Trial end date
 */
export function getTrialEndDate(startDate: Date): Date {
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(startDate.getTime() + TRIAL_DURATION_DAYS * msPerDay);
}
