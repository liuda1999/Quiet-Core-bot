import { refreshCostUsageCache } from "./dist/infra/session-cost-usage.js";

console.log("Starting full usage cost cache refresh...");
const start = Date.now();
const result = await refreshCostUsageCache({ agentId: "main" });
const elapsed = Date.now() - start;
console.log(`Refresh result: ${result}, elapsed: ${elapsed}ms`);
process.exit(0);
