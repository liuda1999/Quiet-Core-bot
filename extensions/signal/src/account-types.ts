// Signal plugin module implements account types behavior.
import type { QuietCoreConfig } from "quiet-core-bot/plugin-sdk/config-contracts";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<QuietCoreConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
