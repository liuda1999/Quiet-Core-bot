/** Handles diagnostics commands and private owner routing for sensitive diagnostics output. */
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { createExecTool } from "../../agents/bash-tools.js";
import type { ExecToolDetails } from "../../agents/bash-tools.js";
import { logVerbose } from "../../globals.js";
import { formatErrorMessage } from "../../infra/errors.js";
import type { ExecApprovalRequest } from "../../infra/exec-approvals.js";
import type { ReplyPayload } from "../types.js";
import {
  buildCurrentOpenClawCliCommand,
  buildCurrentOpenClawCliExecEnv,
} from "./commands-openclaw-cli.js";
import {
  deliverPrivateCommandReply,
  readCommandDeliveryTarget,
  readCommandMessageThreadId,
  resolvePrivateCommandApprovalRouteExpiresAtMs,
  resolvePrivateCommandRouteTargets,
  type PrivateCommandRouteTarget,
} from "./commands-private-route.js";
import type { CommandHandler, HandleCommandsParams } from "./commands-types.js";

const DIAGNOSTICS_COMMAND = "/diagnostics";
const DIAGNOSTICS_DOCS_URL = "https://docs.openclaw.ai/gateway/diagnostics";
const GATEWAY_DIAGNOSTICS_EXPORT_JSON_LABEL = "openclaw gateway diagnostics export --json";
const DIAGNOSTICS_EXEC_SCOPE_KEY = "chat:diagnostics";
const DIAGNOSTICS_PRIVATE_ROUTE_UNAVAILABLE =
  "I couldn't find a private owner approval route for diagnostics. Run /diagnostics from an owner DM so the sensitive diagnostics details are not posted in this chat.";
const DIAGNOSTICS_PRIVATE_ROUTE_ACK =
  "Diagnostics are sensitive. I sent the diagnostics details and approval prompts to the owner privately.";

type DiagnosticsCommandDeps = {
  createExecTool: typeof createExecTool;
  resolvePrivateDiagnosticsTargets: (
    params: HandleCommandsParams,
  ) => Promise<PrivateCommandRouteTarget[]>;
  deliverPrivateDiagnosticsReply: (params: {
    commandParams: HandleCommandsParams;
    targets: PrivateCommandRouteTarget[];
    reply: ReplyPayload;
  }) => Promise<boolean>;
};

type GatewayDiagnosticsApprovalResult =
  | { status: "pending" }
  | { status: "reply"; reply: ReplyPayload };

const defaultDiagnosticsCommandDeps: DiagnosticsCommandDeps = {
  createExecTool,
  resolvePrivateDiagnosticsTargets: resolvePrivateDiagnosticsTargetsForCommand,
  deliverPrivateDiagnosticsReply,
};

/** Creates a diagnostics command handler with injectable private-route dependencies. */
export function createDiagnosticsCommandHandler(
  deps: Partial<DiagnosticsCommandDeps> = {},
): CommandHandler {
  const resolvedDeps: DiagnosticsCommandDeps = {
    ...defaultDiagnosticsCommandDeps,
    ...deps,
  };
  return async (params, allowTextCommands) =>
    await handleDiagnosticsCommandWithDeps(resolvedDeps, params, allowTextCommands);
}

/** Default diagnostics command handler. */
export const handleDiagnosticsCommand: CommandHandler = createDiagnosticsCommandHandler();

async function handleDiagnosticsCommandWithDeps(
  deps: DiagnosticsCommandDeps,
  params: HandleCommandsParams,
  allowTextCommands: boolean,
) {
  if (!allowTextCommands) {
    return null;
  }
  const args = parseDiagnosticsArgs(params.command.commandBodyNormalized);
  if (args == null) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /diagnostics from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (params.isGroup) {
    const targets = await deps.resolvePrivateDiagnosticsTargets(params);
    if (targets.length === 0) {
      return {
        shouldContinue: false,
        reply: { text: DIAGNOSTICS_PRIVATE_ROUTE_UNAVAILABLE },
      };
    }
    const privateTarget = targets[0];
    if (!privateTarget) {
      return {
        shouldContinue: false,
        reply: { text: DIAGNOSTICS_PRIVATE_ROUTE_UNAVAILABLE },
      };
    }
    const privateReply = await buildDiagnosticsReply(deps, params, {
      diagnosticsPrivateRouted: true,
      privateApprovalTarget: privateTarget,
    });
    if (!privateReply) {
      return {
        shouldContinue: false,
        reply: { text: DIAGNOSTICS_PRIVATE_ROUTE_ACK },
      };
    }
    const delivered = await deps.deliverPrivateDiagnosticsReply({
      commandParams: params,
      targets: [privateTarget],
      reply: privateReply,
    });
    return {
      shouldContinue: false,
      reply: {
        text: delivered ? DIAGNOSTICS_PRIVATE_ROUTE_ACK : DIAGNOSTICS_PRIVATE_ROUTE_UNAVAILABLE,
      },
    };
  }

  const reply = await buildDiagnosticsReply(deps, params);
  return reply ? { shouldContinue: false, reply } : { shouldContinue: false };
}

async function buildDiagnosticsReply(
  deps: DiagnosticsCommandDeps,
  params: HandleCommandsParams,
  options: {
    diagnosticsPrivateRouted?: boolean;
    privateApprovalTarget?: PrivateCommandRouteTarget;
  } = {},
): Promise<ReplyPayload | undefined> {
  const gatewayApproval = await requestGatewayDiagnosticsExportApproval(deps, params, options);
  if (gatewayApproval.status === "pending") {
    return undefined;
  }
  return gatewayApproval.reply;
}

function parseDiagnosticsArgs(commandBody: string): string | undefined {
  const trimmed = commandBody.trim();
  if (trimmed === DIAGNOSTICS_COMMAND) {
    return "";
  }
  if (trimmed.startsWith(`${DIAGNOSTICS_COMMAND} `)) {
    return trimmed.slice(DIAGNOSTICS_COMMAND.length + 1).trim();
  }
  if (trimmed.startsWith(`${DIAGNOSTICS_COMMAND}:`)) {
    return trimmed.slice(DIAGNOSTICS_COMMAND.length + 1).trim();
  }
  return undefined;
}

function buildDiagnosticsPreamble(): string[] {
  return [
    "Diagnostics can include sensitive local logs and host-level runtime metadata.",
    `Treat diagnostics bundles like secrets and review what they contain before sharing: ${DIAGNOSTICS_DOCS_URL}`,
  ];
}

function buildDiagnosticsApprovalWarning(): string {
  return buildDiagnosticsPreamble().join("\n");
}

async function resolvePrivateDiagnosticsTargetsForCommand(
  params: HandleCommandsParams,
): Promise<PrivateCommandRouteTarget[]> {
  return await resolvePrivateCommandRouteTargets({
    commandParams: params,
    request: buildDiagnosticsApprovalRequest(params),
  });
}

function buildDiagnosticsApprovalRequest(params: HandleCommandsParams): ExecApprovalRequest {
  const now = Date.now();
  const agentId =
    params.agentId ??
    resolveSessionAgentId({
      sessionKey: params.sessionKey,
      config: params.cfg,
    });
  return {
    id: "diagnostics-private-route",
    request: {
      command: buildGatewayDiagnosticsExportJsonCommand(),
      agentId,
      ...(params.sessionKey ? { sessionKey: params.sessionKey } : {}),
      turnSourceChannel: params.command.channel,
      turnSourceTo: readCommandDeliveryTarget(params) ?? null,
      turnSourceAccountId: params.ctx.AccountId ?? null,
      turnSourceThreadId: readCommandMessageThreadId(params) ?? null,
    },
    createdAtMs: now,
    expiresAtMs: resolvePrivateCommandApprovalRouteExpiresAtMs(now),
  };
}

function buildGatewayDiagnosticsExportJsonCommand(): string {
  return buildCurrentOpenClawCliCommand(["gateway", "diagnostics", "export", "--json"]);
}

async function deliverPrivateDiagnosticsReply(params: {
  commandParams: HandleCommandsParams;
  targets: PrivateCommandRouteTarget[];
  reply: ReplyPayload;
}): Promise<boolean> {
  return await deliverPrivateCommandReply(params);
}

async function requestGatewayDiagnosticsExportApproval(
  deps: DiagnosticsCommandDeps,
  params: HandleCommandsParams,
  options: { privateApprovalTarget?: PrivateCommandRouteTarget } = {},
): Promise<GatewayDiagnosticsApprovalResult> {
  const timeoutSec = params.cfg.tools?.exec?.timeoutSec;
  const agentId =
    params.agentId ??
    resolveSessionAgentId({
      sessionKey: params.sessionKey,
      config: params.cfg,
    });
  const messageThreadId = readCommandMessageThreadId(params);
  const command = buildGatewayDiagnosticsExportJsonCommand();
  try {
    const execTool = deps.createExecTool({
      host: "gateway",
      security: "allowlist",
      ask: "always",
      trigger: "diagnostics",
      scopeKey: DIAGNOSTICS_EXEC_SCOPE_KEY,
      approvalWarningText: buildDiagnosticsApprovalWarning(),
      approvalFollowupMode: "direct",
      allowBackground: true,
      timeoutSec,
      cwd: params.workspaceDir,
      agentId,
      sessionKey: params.sessionKey,
      mainKey: params.cfg.session?.mainKey,
      sessionScope: params.cfg.session?.scope,
      messageProvider: options.privateApprovalTarget?.channel ?? params.command.channel,
      currentChannelId: options.privateApprovalTarget?.to ?? readCommandDeliveryTarget(params),
      currentThreadTs: options.privateApprovalTarget
        ? options.privateApprovalTarget.threadId == null
          ? undefined
          : String(options.privateApprovalTarget.threadId)
        : messageThreadId,
      accountId: options.privateApprovalTarget
        ? (options.privateApprovalTarget.accountId ?? undefined)
        : (params.ctx.AccountId ?? undefined),
      notifyOnExit: params.cfg.tools?.exec?.notifyOnExit,
      notifyOnExitEmptySuccess: params.cfg.tools?.exec?.notifyOnExitEmptySuccess,
    });
    const result = await execTool.execute("chat-diagnostics-gateway-export", {
      command,
      env: buildCurrentOpenClawCliExecEnv(),
      security: "allowlist",
      ask: "always",
      background: true,
      timeout: timeoutSec,
    });
    if (result.details?.status === "approval-pending") {
      return { status: "pending" };
    }
    const lines = buildDiagnosticsPreamble();
    lines.push(
      "",
      `Local Gateway bundle: requested \`${GATEWAY_DIAGNOSTICS_EXPORT_JSON_LABEL}\` through exec approval. Approve once to create the bundle; do not use allow-all for diagnostics.`,
      formatExecToolResultForDiagnostics(result),
    );
    return { status: "reply", reply: { text: lines.join("\n") } };
  } catch (error) {
    const lines = buildDiagnosticsPreamble();
    lines.push(
      "",
      `Local Gateway bundle: could not request exec approval for \`${GATEWAY_DIAGNOSTICS_EXPORT_JSON_LABEL}\`.`,
      formatExecDiagnosticsText(formatErrorMessage(error)),
    );
    return { status: "reply", reply: { text: lines.join("\n") } };
  }
}

function formatExecToolResultForDiagnostics(result: {
  content?: Array<{ type: string; text?: string }>;
  details?: ExecToolDetails;
}): string {
  const text = result.content
    ?.map((chunk) => (chunk.type === "text" && typeof chunk.text === "string" ? chunk.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (text) {
    return formatExecDiagnosticsText(text);
  }
  const details = result.details;
  if (details?.status === "approval-pending") {
    const decisions = details.allowedDecisions?.join(", ") || "allow-once, deny";
    return formatExecDiagnosticsText(
      `Exec approval pending (${details.approvalSlug}). Allowed decisions: ${decisions}.`,
    );
  }
  if (details?.status === "running") {
    return formatExecDiagnosticsText(
      `Gateway diagnostics export is running (exec session ${details.sessionId}).`,
    );
  }
  if (details?.status === "completed" || details?.status === "failed") {
    return formatExecDiagnosticsText(details.aggregated);
  }
  return "(no exec details returned)";
}

function formatExecDiagnosticsText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "(no exec output)";
  }
  return trimmed;
}
