// Tlon plugin module implements doctor behavior.
import type { ChannelDoctorAdapter } from "quiet-core-bot/plugin-sdk/channel-contract";
import {
  legacyConfigRules as TLON_LEGACY_CONFIG_RULES,
  normalizeCompatibilityConfig as normalizeTlonCompatibilityConfig,
} from "./doctor-contract.js";

export const tlonDoctor: ChannelDoctorAdapter = {
  legacyConfigRules: TLON_LEGACY_CONFIG_RULES,
  normalizeCompatibilityConfig: normalizeTlonCompatibilityConfig,
};
