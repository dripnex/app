/**
 * Plan definitions and features
 * Freemium + Pro Subscription model
 */

export const PLANS = {
  free: {
    id: 'free' as const,
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
    id: 'pro' as const,
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
  },
} as const;

export const GUARANTEES = {
  refund: {
    days: 14,
    description: '14-day money-back guarantee, no questions asked',
  },
  noLockIn: {
    description: 'Export anytime. Your notes are standard Markdown.',
  },
  freeTierForever: {
    description: 'Free tier works forever. No tricks, no time limits.',
  },
  cancelAnytime: {
    description: 'Cancel your Pro subscription anytime. Keep using Free.',
  },
} as const;

export type PlanId = 'free' | 'pro';
export type PlansConfig = typeof PLANS;
export type GuaranteesConfig = typeof GUARANTEES;
