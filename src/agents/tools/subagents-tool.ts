/**
 * subagents built-in tool.
 *
 * Lists active and recent subagents controlled by the caller's session tree,
 * and joins one child run's persisted terminal result by run id or session key.
 */
import { Type } from "typebox";
import { resolveSubagentLabel } from "../../auto-reply/reply/subagents-utils.js";
import { getRuntimeConfig } from "../../config/config.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { optionalPositiveIntegerSchema, optionalStringEnum } from "../schema/typebox.js";
import {
  buildSubagentErrorSummary,
  readSubagentToolFailures,
  type SubagentToolFailure,
} from "../subagent-announce-output.js";
import {
  DEFAULT_RECENT_MINUTES,
  listControlledSubagentRuns,
  MAX_RECENT_MINUTES,
  resolveSubagentController,
  type ResolvedSubagentController,
} from "../subagent-control.js";
import { buildSubagentList } from "../subagent-list.js";
import { readSubagentRunRecordFromSqlite } from "../subagent-registry.store.sqlite.js";
import type { SubagentRunRecord } from "../subagent-registry.types.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readPositiveIntegerParam, readStringParam } from "./common.js";

const SUBAGENT_ACTIONS = ["list", "result"] as const;
type SubagentAction = (typeof SUBAGENT_ACTIONS)[number];

const SubagentsToolSchema = Type.Object({
  action: optionalStringEnum(SUBAGENT_ACTIONS, {
    description:
      'Action to run. "list" (default) lists active/recent subagents; "result" returns one subagent run terminal result.',
  }),
  recentMinutes: optionalPositiveIntegerSchema(),
  runId: Type.Optional(
    Type.String({
      description: 'Run id to join for action "result".',
    }),
  ),
  childSessionKey: Type.Optional(
    Type.String({
      description: 'Child session key to join for action "result" (latest run wins).',
    }),
  ),
});

/** Resolves the persisted owner (controller or requester) of a subagent run. */
function resolveRunOwnerSessionKey(entry: SubagentRunRecord): string {
  return entry.controllerSessionKey?.trim() || entry.requesterSessionKey?.trim() || "";
}

function ensureControllerCanReadRun(params: {
  controller: ResolvedSubagentController;
  entry: SubagentRunRecord;
}): string | undefined {
  const owner = resolveRunOwnerSessionKey(params.entry);
  if (owner === params.controller.controllerSessionKey) {
    return undefined;
  }
  return "Subagents can only read runs spawned from their own session.";
}

/**
 * Builds the terminal result view for one persisted subagent run.
 *
 * Status/timing come from the persisted `subagent_runs` row; failed tool calls
 * are summarized from the child transcript because the run row does not store
 * per-tool failure evidence.
 */
async function buildSubagentRunResultView(entry: SubagentRunRecord) {
  const outcome = entry.outcome;
  let toolFailures: SubagentToolFailure[] = [];
  const endedWithoutSuccess = !outcome || outcome.status !== "ok";
  if (endedWithoutSuccess) {
    try {
      toolFailures = await readSubagentToolFailures(entry.childSessionKey);
    } catch {
      // Failure evidence is best-effort; the terminal state still comes from sqlite.
    }
  }
  const errorSummary = outcome ? buildSubagentErrorSummary({ outcome, toolFailures }) : undefined;
  const deliveryError = entry.delivery?.lastError?.trim();
  const status = !entry.endedAt ? "running" : (outcome?.status ?? "unknown");
  const failureText = [errorSummary, deliveryError ? `delivery: ${deliveryError}` : undefined]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
  return {
    status,
    runId: entry.runId,
    childSessionKey: entry.childSessionKey,
    label: resolveSubagentLabel(entry),
    task: entry.task,
    ...(entry.taskName ? { taskName: entry.taskName } : {}),
    ...(typeof entry.startedAt === "number" ? { startedAt: entry.startedAt } : {}),
    ...(typeof entry.endedAt === "number" ? { endedAt: entry.endedAt } : {}),
    ...(outcome?.status ? { outcomeStatus: outcome.status } : {}),
    ...(outcome?.error ? { outcomeError: outcome.error } : {}),
    ...(errorSummary ? { errorSummary } : {}),
    ...(toolFailures.length > 0 ? { toolFailures } : {}),
    ...(deliveryError ? { deliveryError } : {}),
    ...(entry.completion?.resultText ? { resultText: entry.completion.resultText } : {}),
    text: `${resolveSubagentLabel(entry)}: ${status}${failureText ? ` - ${failureText}` : ""}`,
  };
}

/** Creates the subagents list/result tool scoped to the caller's controlled session tree. */
export function createSubagentsTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Subagents",
    name: "subagents",
    description:
      'Observe and join only: list active/recent subagents for the requester session, or read one subagent run terminal result with action="result". This tool never starts work — use sessions_spawn to dispatch a subagent. If sessions_yield exists, use it for completion; do not poll wait loops.',
    parameters: SubagentsToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = (readStringParam(params, "action") ?? "list") as SubagentAction;
      const cfg = getRuntimeConfig();
      const controller = resolveSubagentController({
        cfg,
        agentSessionKey: opts?.agentSessionKey,
      });

      if (action === "result") {
        const runId = readStringParam(params, "runId");
        const childSessionKey = readStringParam(params, "childSessionKey");
        if (!runId && !childSessionKey) {
          return jsonResult({
            status: "error",
            action: "result",
            error: "runId or childSessionKey required.",
          });
        }
        let entry: SubagentRunRecord | null = null;
        try {
          entry = readSubagentRunRecordFromSqlite({ runId, childSessionKey });
        } catch (error) {
          return jsonResult({
            status: "error",
            action: "result",
            ...(runId ? { runId } : {}),
            ...(childSessionKey ? { childSessionKey } : {}),
            error: formatErrorMessage(error),
          });
        }
        if (!entry) {
          return jsonResult({
            status: "not_found",
            action: "result",
            requesterSessionKey: controller.controllerSessionKey,
            ...(runId ? { runId } : {}),
            ...(childSessionKey ? { childSessionKey } : {}),
            error: "No subagent run found for the requested runId/childSessionKey.",
          });
        }
        const ownershipError = ensureControllerCanReadRun({ controller, entry });
        if (ownershipError) {
          return jsonResult({
            status: "forbidden",
            action: "result",
            runId: entry.runId,
            childSessionKey: entry.childSessionKey,
            error: ownershipError,
          });
        }
        return jsonResult({
          status: "ok",
          action: "result",
          requesterSessionKey: controller.controllerSessionKey,
          callerSessionKey: controller.callerSessionKey,
          callerIsSubagent: controller.callerIsSubagent,
          run: await buildSubagentRunResultView(entry),
        });
      }

      const recentMinutesRaw = readPositiveIntegerParam(params, "recentMinutes");
      const recentMinutes =
        recentMinutesRaw === undefined
          ? DEFAULT_RECENT_MINUTES
          : Math.min(MAX_RECENT_MINUTES, recentMinutesRaw);
      // The caller only sees subagents controlled by its effective controller session.
      const runs = listControlledSubagentRuns(controller.controllerSessionKey);

      if (action === "list") {
        const list = buildSubagentList({
          cfg,
          runs,
          recentMinutes,
        });
        return jsonResult({
          status: "ok",
          action: "list",
          requesterSessionKey: controller.controllerSessionKey,
          callerSessionKey: controller.callerSessionKey,
          callerIsSubagent: controller.callerIsSubagent,
          total: list.total,
          active: list.active.map(({ line: _line, ...view }) => view),
          recent: list.recent.map(({ line: _line, ...view }) => view),
          text: list.text,
        });
      }

      return jsonResult({
        status: "error",
        error: "Unsupported action.",
      });
    },
  };
}
