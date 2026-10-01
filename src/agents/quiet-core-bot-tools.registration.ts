/**
 * Quiet Core bot-owned tool registration filters.
 *
 * Keeps optional tool gating separate from tool construction so config and execution contracts decide exposure.
 */
import { uniqueStrings } from "@quiet-core/normalization-core/string-normalization";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import { isStrictAgenticExecutionContractActive } from "./execution-contract.js";
import { isToolAllowedByPolicyName } from "./tool-policy-match.js";
import type { AnyAgentTool } from "./tools/common.js";

/**
 * Registration helpers for optional Quiet Core bot-owned tools.
 *
 * This keeps model/runtime gating separate from tool construction so callers can
 * assemble candidate tools first, then filter by config and execution contract.
 */
/** Drops disabled optional tools while preserving candidate order. */
export function collectPresentQuietCoreTools(
  candidates: readonly (AnyAgentTool | null | undefined)[],
): AnyAgentTool[] {
  return candidates.filter((tool): tool is AnyAgentTool => tool !== null && tool !== undefined);
}

/** Resolves the default update_plan switch from explicit config or strict execution contract. */
function isUpdatePlanToolEnabledForQuietCoreTools(params: {
  config?: QuietCoreConfig;
  agentSessionKey?: string;
  agentId?: string | null;
  modelProvider?: string;
  modelId?: string;
}): boolean {
  const configured = params.config?.tools?.experimental?.planTool;
  if (configured !== undefined) {
    return configured;
  }
  return isStrictAgenticExecutionContractActive({
    config: params.config,
    sessionKey: params.agentSessionKey,
    agentId: params.agentId,
    provider: params.modelProvider,
    modelId: params.modelId,
  });
}

function mergeQuietCoreToolPolicyList(...lists: Array<string[] | undefined>): string[] | undefined {
  const merged = lists.flatMap((list) => (Array.isArray(list) ? list : []));
  return merged.length > 0 ? uniqueStrings(merged) : undefined;
}

function isToolExplicitlyAllowedByQuietCoreToolPolicy(params: {
  toolName: string;
  allowlist?: string[];
  denylist?: string[];
}): boolean {
  if (!params.allowlist?.some((entry) => typeof entry === "string" && entry.trim().length > 0)) {
    return false;
  }
  return isToolAllowedByPolicyName(params.toolName, {
    allow: params.allowlist,
    deny: params.denylist,
  });
}

/** Decides whether update_plan should be included in the assembled Quiet Core bot tool set. */
export function shouldIncludeUpdatePlanToolForQuietCoreTools(params: {
  config?: QuietCoreConfig;
  agentSessionKey?: string;
  agentId?: string | null;
  modelProvider?: string;
  modelId?: string;
  pluginToolAllowlist?: string[];
  pluginToolDenylist?: string[];
}): boolean {
  const allowlist = mergeQuietCoreToolPolicyList(
    params.config?.tools?.allow,
    params.config?.tools?.alsoAllow,
    params.pluginToolAllowlist,
  );
  const denylist = mergeQuietCoreToolPolicyList(
    params.config?.tools?.deny,
    params.pluginToolDenylist,
  );
  return (
    isToolExplicitlyAllowedByQuietCoreToolPolicy({
      toolName: "update_plan",
      allowlist,
      denylist,
    }) ||
    isUpdatePlanToolEnabledForQuietCoreTools({
      config: params.config,
      agentSessionKey: params.agentSessionKey,
      agentId: params.agentId,
      modelProvider: params.modelProvider,
      modelId: params.modelId,
    })
  );
}
