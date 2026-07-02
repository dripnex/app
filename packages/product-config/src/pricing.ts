/**
 * Dripnex pricing configuration
 * Freemium + Pro Subscription model
 */

export const PRICING = {
  free: {
    amount: 0,
    currency: 'USD',
    label: 'Free',
    description: 'Local notes, offline forever',
  },
  pro: {
    monthly: {
      amount: 2.99,
      currency: 'USD',
      label: '$2.99/mo',
      interval: 'month' as const,
      description: 'Billed monthly',
    },
    annual: {
      amount: 29,
      currency: 'USD',
      label: '$29/year',
      interval: 'year' as const,
      monthlyEquivalent: 2.42,
      savings: '19%',
      description: 'Save 19% with annual billing',
    },
  },
  trial: {
    days: 14,
    tier: 'pro' as const,
    description: '14-day Pro trial, no credit card required',
  },
} as const;

export type PricingConfig = typeof PRICING;
export type BillingInterval = 'month' | 'year';
