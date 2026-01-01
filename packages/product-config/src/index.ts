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
} from './facade.js';

// ═══════════════════════════════════════════════════════════════
// RAW DATA (DEPRECATED - use getProductConfig() instead)
// ═══════════════════════════════════════════════════════════════

/** @deprecated Use getProductConfig().plans instead */
export { PLANS, GUARANTEES } from './plans.js';

/** @deprecated Use getProductConfig() instead */
export { PRICING } from './pricing.js';

/** @deprecated Use getProductConfig().trialDays instead */
export { TRIAL } from './trial.js';

/** @deprecated Use types from facade.js */
export type { PricingConfig } from './pricing.js';

/** @deprecated Use types from facade.js */
export type { TrialConfig } from './trial.js';

/** @deprecated Use types from facade.js */
export type { PlansConfig, GuaranteesConfig } from './plans.js';

// ═══════════════════════════════════════════════════════════════
// URLS (not deprecated - not part of product config)
// ═══════════════════════════════════════════════════════════════

export { URLS } from './urls.js';
export type { UrlsConfig } from './urls.js';
