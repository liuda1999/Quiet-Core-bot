// Migrate Hermes plugin module implements targets behavior.
import path from "node:path";
import {
  resolveAgentConfig,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "quiet-core-bot/plugin-sdk/agent-runtime";
import type { MigrationProviderContext } from "quiet-core-bot/plugin-sdk/plugin-entry";
import { resolveHomePath } from "./helpers.js";

export type PlannedTargets = {
  workspaceDir: string;
  stateDir: string;
  agentDir: string;
};

export function resolveTargets(ctx: MigrationProviderContext): PlannedTargets {
  const cfg = ctx.config;
  const agentId = resolveDefaultAgentId(cfg);
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const configuredAgentDir = resolveAgentConfig(cfg, agentId)?.agentDir?.trim();
  const agentDir =
    ctx.runtime?.agent?.resolveAgentDir(cfg, agentId) ??
    (configuredAgentDir ? resolveHomePath(configuredAgentDir) : undefined) ??
    path.join(ctx.stateDir, "agents", agentId, "agent");
  return {
    workspaceDir,
    stateDir: ctx.stateDir,
    agentDir,
  };
}
