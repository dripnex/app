/**
 * Facade API for product configuration
 *
 * This provides a STABLE public interface for consumers.
 * Use getProductConfig() instead of importing raw data exports.
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// FACADE
// ═══════════════════════════════════════════════════════════════

/**
 * Returns a stable public config shape.
 *
 * This is the PREFERRED API - consumers should use this function
 * instead of importing raw data exports (PRICING, PLANS, etc.)
 *
 * @example
 * ```typescript
 * const config = getProductConfig();
 * console.log(config.plans.pro.pricing?.intervals.monthly.label); // '$2.99/mo'
 * console.log(config.trialDays); // 14
 * ```
 */
export function getProductConfig(): ProductConfig {
  return {
    trialDays: 14,
    trialDescription: '14-day Pro trial, no credit card required',
    plans: {
      free: {
        name: 'Free',
        description: 'Perfect for personal note-taking',
        features: [
          'Unlimited local notes',
          'Full markdown editor',
          'Export to markdown',
          'Import from folder',
          'Basic search',
          '100% offline',
          'No account required',
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
            monthly: { label: '$2.99/mo', amountCents: 299 },
            annual: { label: '$29/year', amountCents: 2900 },
          },
          annualSavings: '19%',
        },
      },
    },
    guarantees: {
      refund: { description: '14-day money-back guarantee, no questions asked' },
      noLockIn: { description: 'Export anytime. Your notes are standard Markdown.' },
      freeTierForever: { description: 'Free tier works forever. No tricks, no time limits.' },
      cancelAnytime: { description: 'Cancel your Pro subscription anytime. Keep using Free.' },
    },
  };
}
