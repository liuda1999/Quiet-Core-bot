// Agent database path helpers resolve per-agent persisted database paths.
import path from "node:path";
import { normalizeAgentId } from "../routing/session-key.js";
import { resolveQuietCoreStateSqliteDir } from "./quiet-core-bot-state-db.paths.js";

/**
 * Path helpers for per-agent SQLite state.
 *
 * Agent databases live beside the shared state database root so each agent can
 * own private runtime tables while the shared registry can still discover them.
 */
/** Inputs for resolving one agent SQLite path or directory. */
export type QuietCoreAgentSqlitePathOptions = {
  agentId: string;
  env?: NodeJS.ProcessEnv;
  path?: string;
};

/** Resolve the SQLite file for one normalized agent id. */
export function resolveQuietCoreAgentSqlitePath(options: QuietCoreAgentSqlitePathOptions): string {
  const agentId = normalizeAgentId(options.agentId);
  return path.resolve(
    options.path ??
      path.join(
        path.dirname(resolveQuietCoreStateSqliteDir(options.env ?? process.env)),
        "agents",
        agentId,
        "agent",
        "quiet-core-bot-agent.sqlite",
      ),
  );
}
