// Nextcloud Talk plugin module implements doctor contract behavior.
import { createLegacyPrivateNetworkDoctorContract } from "quiet-core-bot/plugin-sdk/ssrf-runtime";

const contract = createLegacyPrivateNetworkDoctorContract({
  channelKey: "nextcloud-talk",
});

export const legacyConfigRules = contract.legacyConfigRules;

export const normalizeCompatibilityConfig = contract.normalizeCompatibilityConfig;
