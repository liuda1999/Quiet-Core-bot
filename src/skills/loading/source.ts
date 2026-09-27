// Skill source helpers normalize source metadata for loaded skill records.
import { normalizeOptionalString } from "@quiet-core/normalization-core/string-coerce";
import type { SkillTelemetrySource } from "../types.js";
import type { Skill } from "./skill-contract.js";

type SkillSourceCompat = Skill & {
  sourceInfo?: {
    source?: string;
  };
};

/** Returns the stable source label attached to a loaded skill. */
export function resolveSkillSource(skill: Skill): string {
  const compatSkill = skill as SkillSourceCompat;
  const canonical = normalizeOptionalString(compatSkill.source) ?? "";
  if (canonical) {
    return canonical;
  }
  const legacy = normalizeOptionalString(compatSkill.sourceInfo?.source) ?? "";
  return legacy || "unknown";
}

export function resolveSkillTelemetrySourceValue(value: unknown): SkillTelemetrySource {
  const source = normalizeOptionalString(value) ?? "";
  if (source === "bundled" || source === "quiet-core-bot-bundled") {
    return "bundled";
  }
  if (
    source === "workspace" ||
    source === "quiet-core-bot-workspace" ||
    source === "quiet-core-bot-managed" ||
    source === "quiet-core-bot-extra" ||
    source === "agents-skills-personal" ||
    source === "agents-skills-project"
  ) {
    return "workspace";
  }
  return "unknown";
}

export function resolveSkillTelemetrySource(skill: Skill): SkillTelemetrySource {
  return resolveSkillTelemetrySourceValue(resolveSkillSource(skill));
}
