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
} from './facade';

// ═══════════════════════════════════════════════════════════════
// RAW DATA (DEPRECATED - use getProductConfig() instead)
// ═══════════════════════════════════════════════════════════════

/** @deprecated Use getProductConfig().plans instead */
export { PLANS, GUARANTEES } from './plans';

/** @deprecated Use getProductConfig() instead */
export { PRICING } from './pricing';

/** @deprecated Use getProductConfig().trialDays instead */
export { TRIAL } from './trial';

/** @deprecated Use types from facade.js */
export type { PricingConfig } from './pricing';

/** @deprecated Use types from facade.js */
export type { TrialConfig } from './trial';

/** @deprecated Use types from facade.js */
export type { PlansConfig, GuaranteesConfig } from './plans';

// ═══════════════════════════════════════════════════════════════
// URLS (not deprecated - not part of product config)
// ═══════════════════════════════════════════════════════════════

export { URLS } from './urls';
export type { UrlsConfig } from './urls';
