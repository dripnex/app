/**
 * Plan definitions and features
 */

export const PLANS = {
  pro: {
    id: 'pro' as const,
    name: 'Pro',
    features: [
      'The app, forever',
      '12 months of updates',
      'No feature restrictions',
      'Mac & Windows',
    ],
  },
} as const;

export const GUARANTEES = {
  refund: {
    days: 14,
    description: '14-day money-back guarantee, no questions asked',
  },
  perpetual: {
    description: 'Your app keeps working. Your files are standard Markdown.',
  },
  noLockIn: {
    description: 'Export anytime. Your notes are portable.',
  },
} as const;

export type PlansConfig = typeof PLANS;
export type GuaranteesConfig = typeof GUARANTEES;
