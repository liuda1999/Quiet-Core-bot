// Tlon plugin module implements doctor contract behavior.
import { createLegacyPrivateNetworkDoctorContract } from "quiet-core-bot/plugin-sdk/ssrf-runtime";

const contract = createLegacyPrivateNetworkDoctorContract({
  channelKey: "tlon",
});

export const legacyConfigRules = contract.legacyConfigRules;

export const normalizeCompatibilityConfig = contract.normalizeCompatibilityConfig;
