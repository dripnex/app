/**
 * Trial configuration
 */

export const TRIAL = {
  durationDays: 14,
  features: 'all' as const,
  description: '14-day free trial, all features included',
} as const;

export type TrialConfig = typeof TRIAL;
