/** Doctor diagnostics for the persisted embedded-run ledger (`agent_runs`). */
import { note } from "../../packages/terminal-core/src/note.js";
import { formatCliCommand } from "../cli/command-format.js";
import { listAgentRuns, type AgentRunLedgerEntry } from "../state/agent-runs-store.js";

const MAX_DISPLAYED_INTERRUPTED_RUNS = 10;

function formatAgentRunLine(entry: AgentRunLedgerEntry): string {
  const session = entry.sessionKey ?? entry.sessionId ?? "unknown session";
  const reason = entry.endedReason ? ` reason=${entry.endedReason}` : "";
  return `- ${entry.runId} status=${entry.status} session=${session}${reason}`;
}

/**
 * Reports runs a previous gateway process left behind as `interrupted`.
 *
 * The ledger sweep runs inside the query, so this note also surfaces runs that
 * a crash left as `running` without a later process starting its own run.
 */
export async function noteAgentRunLedgerHealth(params?: {
  listRuns?: typeof listAgentRuns;
}): Promise<void> {
  const listRuns = params?.listRuns ?? listAgentRuns;
  let interrupted: AgentRunLedgerEntry[];
  try {
    interrupted = listRuns({ status: "interrupted", limit: MAX_DISPLAYED_INTERRUPTED_RUNS });
  } catch (err) {
    note(`- Failed to inspect persisted agent runs: ${String(err)}`, "Agent runs");
    return;
  }
  if (interrupted.length === 0) {
    return;
  }
  note(
    [
      "- Runs interrupted by a gateway restart were found in the persisted run ledger:",
      ...interrupted.map(formatAgentRunLine),
      `- Use ${formatCliCommand("openclaw gateway restart --safe")} for later restarts so active runs drain before the gateway stops.`,
    ].join("\n"),
    "Agent runs",
  );
}
