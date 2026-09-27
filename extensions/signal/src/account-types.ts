// Signal plugin module implements account types behavior.
import type { OpenClawConfig } from "quiet-core-bot/plugin-sdk/config-contracts";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<OpenClawConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
