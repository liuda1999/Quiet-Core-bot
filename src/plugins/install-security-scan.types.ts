// Defines plugin install security scan result types.
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";

/** Overrides that intentionally loosen install safety policy for trusted/operator paths. */
export type InstallSafetyOverrides = {
  config?: QuietCoreConfig;
  dangerouslyForceUnsafeInstall?: boolean;
  trustedSourceLinkedOfficialInstall?: boolean;
};
