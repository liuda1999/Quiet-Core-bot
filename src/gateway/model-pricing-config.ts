// Gateway model-pricing config helper.
// Resolves whether cost/pricing metadata should be available to Gateway surfaces.
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";

/** Returns whether gateway model pricing/cost metadata should be shown. */
export function isGatewayModelPricingEnabled(config: QuietCoreConfig): boolean {
  return config.models?.pricing?.enabled !== false;
}
