/**
 * Facade API for product configuration
 *
 * This provides a STABLE public interface for consumers.
 * Use getProductConfig() instead of importing raw data exports.
 */

export type BillingInterval = 'monthly' | 'annual';
export type PlanId = 'free' | 'pro';
export type GuaranteeId = 'refund' | 'noLockIn' | 'freeTierForever' | 'cancelAnytime';

export interface PlanPricing {
  readonly label: string;
  readonly amountCents: number;
}

export interface PlanConfig {
  readonly name: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly pricing?: {
    readonly intervals: Record<BillingInterval, PlanPricing>;
    readonly annualSavings?: string;
  };
}

export interface ProductConfig {
  readonly trialDays: number;
  readonly trialDescription: string;
  readonly plans: Record<PlanId, PlanConfig>;
  readonly guarantees: Record<GuaranteeId, { readonly description: string }>;
}

export function getProductConfig(): ProductConfig {
  return {
    trialDays: 14,
    trialDescription: '14-day Pro trial, no credit card required',
    plans: {
      free: {
        name: 'Free',
        description: 'Local SQLite notes after AuthGate',
        features: [
          'Unlimited local notes',
          'Full markdown editor',
          'Export to markdown',
          'Import from folder',
          'Basic search',
          'Offline after login',
          'Account required (AuthGate)',
        ],
      },
      pro: {
        name: 'Pro',
        description: 'For power users who want sync and advanced features',
        features: [
          'Everything in Free',
          'Cloud sync across devices',
          'Automatic backlinks',
          'Visual graph view',
          'Custom themes',
          'Advanced search',
          'Import Obsidian vault',
          'Priority support',
        ],
        pricing: {
          intervals: {
            monthly: { label: '€2/mo', amountCents: 200 },
            annual: { label: '€20/year', amountCents: 2000 },
          },
          annualSavings: '17%',
        },
      },
    },
    guarantees: {
      refund: { description: '14-day money-back guarantee, no questions asked' },
      noLockIn: { description: 'Export to Markdown anytime. SQLite is the store.' },
      freeTierForever: { description: 'Free tier works forever. No tricks, no time limits.' },
      cancelAnytime: { description: 'Cancel your Pro subscription anytime. Keep using Free.' },
    },
  };
}
