/** Re-exports legacy state migration helpers used by doctor preflight. */
export type { LegacyStateDetection } from "../infra/state-migrations.js";
export {
  autoMigrateLegacyTaskStateSidecars,
  autoMigrateLegacyState,
  detectLegacyStateMigrations,
  migrateLegacyAgentDir,
  resetAutoMigrateLegacyTaskStateSidecarsForTest,
  resetAutoMigrateLegacyStateForTest,
  runLegacyStateMigrations,
} from "../infra/state-migrations.js";
