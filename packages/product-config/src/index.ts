// ═══════════════════════════════════════════════════════════════
// PUBLIC API (PREFERRED)
// ═══════════════════════════════════════════════════════════════

export {
  getProductConfig,
  type ProductConfig,
  type PlanConfig,
  type PlanPricing,
  type PlanId,
  type BillingInterval,
  type GuaranteeId,
} from './facade.ts';

// ═══════════════════════════════════════════════════════════════
// RAW DATA (DEPRECATED - use getProductConfig() instead)
// ═══════════════════════════════════════════════════════════════

/** @deprecated Use getProductConfig().plans instead */
export { PLANS, GUARANTEES } from './plans.ts';

/** @deprecated Use getProductConfig() instead */
export { PRICING } from './pricing.ts';

/** @deprecated Use getProductConfig().trialDays instead */
export { TRIAL } from './trial.ts';

/** @deprecated Use types from facade.js */
export type { PricingConfig } from './pricing.ts';

/** @deprecated Use types from facade.js */
export type { TrialConfig } from './trial.ts';

/** @deprecated Use types from facade.js */
export type { PlansConfig, GuaranteesConfig } from './plans.ts';

// ═══════════════════════════════════════════════════════════════
// URLS (not deprecated - not part of product config)
// ═══════════════════════════════════════════════════════════════

export { URLS } from './urls.ts';
export type { UrlsConfig } from './urls.ts';
