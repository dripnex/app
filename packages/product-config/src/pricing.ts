/**
 * Readied pricing configuration
 * Single source of truth for all pricing displayed in marketing and app
 */

export const PRICING = {
  license: {
    amount: 79,
    currency: 'USD',
    label: '$79',
    type: 'one-time' as const,
    description: 'One-time payment, own the app forever',
  },
  renewal: {
    amount: 39,
    currency: 'USD',
    label: '$39/year',
    type: 'annual' as const,
    description: 'For continued updates. App keeps working regardless.',
  },
  updatesPeriodMonths: 12,
} as const;

export type PricingConfig = typeof PRICING;
