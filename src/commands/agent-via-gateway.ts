// Gateway-first agent CLI implementation with embedded fallback for local/runtime failures.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TextDecoder } from "node:util";
import { resolveTimerTimeoutMs } from "@quiet-core/normalization-core/number-coercion";
import { normalizeOptionalString } from "@quiet-core/normalization-core/string-coerce";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
} from "../../packages/gateway-protocol/src/client-info.js";
import { listAgentIds, resolveDefaultAgentId } from "../agents/agent-scope-config.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { CliDeps } from "../cli/deps.types.js";
import { withProgress } from "../cli/progress.js";
import {
  readGatewayDispatchConfig,
  readGatewayDispatchConfigWithShellEnvFallback,
} from "../config/gateway-dispatch-config.js";
import type { OpenClawConfig } from "../config/types.quiet-core-bot.js";
import {
  callGateway,
  isGatewayCredentialsRequiredError,
  isGatewayExplicitAuthRequiredError,
  isGatewayTransportError,
  randomIdempotencyKey,
  type GatewayRequestFunction,
} from "../gateway/call.js";
import { isGatewaySecretRefUnavailableError } from "../gateway/credentials.js";
import { ADMIN_SCOPE } from "../gateway/operator-scopes.js";
import { parseStrictNonNegativeInteger } from "../infra/parse-finite-number.js";
import { routeLogsToStderr } from "../logging/console.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  classifySessionKeyShape,
  isUnscopedSessionKeySentinel,
  normalizeAgentId,
  resolveAgentIdFromSessionKey,
  scopeLegacySessionKeyToAgent,
} from "../routing/session-key.js";
import { type RuntimeEnv, writeRuntimeJson } from "../runtime.js";
import { normalizeMessageChannel } from "../utils/message-channel-normalize.js";

type AgentGatewayResult = {
  payloads?: Array<{
    text?: string;
    mediaUrl?: string | null;
    mediaUrls?: string[];
  }>;
  deliveryStatus?: unknown;
  meta?: unknown;
};

type GatewayAgentResponse = {
  runId?: string;
  status?: string;
  summary?: string;
  result?: AgentGatewayResult;
  deliveryStatus?: unknown;
};

const NO_GATEWAY_TIMEOUT_MS = 2_147_000_000;
const EMBEDDED_FALLBACK_META = {
  transport: "embedded",
  fallbackFrom: "gateway",
} as const;
const GATEWAY_TIMEOUT_FALLBACK_SESSION_PREFIX = "gateway-fallback-";
const GATEWAY_TRANSIENT_CONNECT_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 15_000] as const;

/**
 * Diagnostic scope for "the CLI fell back to an embedded agent run".
 *
 * I20: when the gateway is unreachable the CLI silently re-runs the whole turn in
 * its own process, so the gateway ledger has no record that a fallback (and the
 * possible replay of already-completed tool side effects) happened. The CLI cannot
 * reach the gateway in exactly that situation, so the record is written to the
 * shared local state DB (`diagnostic_events`) instead. Keyed by the CLI dispatch
 * run id, so one row per CLI invocation.
 */
export const CLI_EMBEDDED_FALLBACK_SCOPE = "cli_embedded_fallback";

/** Best-effort record of one CLI embedded fallback (never throws, never blocks). */
async function recordEmbeddedFallback(params: {
  runId: string;
  reason: "gateway_timeout" | "gateway_failure";
  error: unknown;
  sessionKey?: string;
  sessionId?: string;
  fallbackRunId?: string;
}): Promise<void> {
  try {
    const { writeDiagnosticEvent } = await import("../state/diagnostic-events-store.js");
    writeDiagnosticEvent({
      scope: CLI_EMBEDDED_FALLBACK_SCOPE,
      eventKey: params.runId,
      payload: {
        runId: params.runId,
        reason: params.reason,
        pid: process.pid,
        gatewayError: String(params.error),
        // The fallback re-runs the entire turn locally, so tool side effects that
        // already executed on the gateway side can be replayed.
        replayRisk: "whole_turn_rerun",
        ...(params.sessionKey ? { sessionKey: params.sessionKey } : {}),
        ...(params.sessionId ? { sessionId: params.sessionId } : {}),
        ...(params.fallbackRunId ? { fallbackRunId: params.fallbackRunId } : {}),
      },
    });
  } catch {
    // Diagnostics must never block the fallback path.
  }
}

/**
 * D5: emit an explicit pre-fallback warning before the CLI commits to an
 * embedded agent run, so the whole-turn rerun is never silent. `gateway_failure`
 * re-runs the entire turn in-process (already-completed tool side effects can be
 * replayed); `gateway_timeout` runs a fresh session. Surfaces a user-facing
 * message and records a `[cli-fallback]` log.warn attributed to the run id.
 * Always succeeds; never blocks the fallback path.
 */
const cliFallbackLog = createSubsystemLogger("cli-fallback");

function warnBeforeEmbeddedFallback(params: {
  runtime: RuntimeEnv;
  runId: string;
  reason: "gateway_timeout" | "gateway_failure";
  err: unknown;
}): void {
  const { runtime, runId, reason, err } = params;
  const rerun = reason === "gateway_failure";
  const advisory = rerun
    ? "This will re-run the ENTIRE turn inside the CLI process; tool side effects that already executed against the gateway may be REPLAYED, and the gateway ledger has no record of this fallback. If the gateway failure is transient, verify the gateway is healthy and consider retrying before confirming the fallback."
    : "This will run the embedded agent with a fresh session (GATEWAY_TIMEOUT_FALLBACK_SESSION_PREFIX).";
  const message = `[cli-fallback] Gateway ${reason === "gateway_timeout" ? "timed out" : "unavailable"}; falling back to an embedded ${
    rerun ? "in-process whole-turn rerun" : "run with a fresh session"
  } for runId=${runId}. ${advisory}`;
  runtime.error?.(message);
  cliFallbackLog.warn(message, {
    reason,
    runId,
    ...(rerun ? { replayRisk: "whole_turn_rerun" as const } : {}),
    gatewayError: String(err),
  });
}

type AgentCliOpts = {
  message?: string;
  messageFile?: string;
  agent?: string;
  model?: string;
  to?: string;
  sessionId?: string;
  sessionKey?: string;
  thinking?: string;
  verbose?: string;
  json?: boolean;
  timeout?: string;
  deliver?: boolean;
  channel?: string;
  replyTo?: string;
  replyChannel?: string;
  replyAccount?: string;
  bestEffortDeliver?: boolean;
  lane?: string;
  runId?: string;
  extraSystemPrompt?: string;
  local?: boolean;
};
type AgentDispatchOpts = Omit<AgentCliOpts, "messageFile"> & {
  message: string;
};

type AgentCliSignal = "SIGINT" | "SIGTERM";
type AgentCliProcessLike = {
  on(signal: AgentCliSignal, handler: () => void): unknown;
  off(signal: AgentCliSignal, handler: () => void): unknown;
};
type AgentCliDeps = CliDeps & {
  process?: AgentCliProcessLike;
};
type AgentGatewayCallIdentity = Pick<
  Parameters<typeof callGateway>[0],
  "clientName" | "mode" | "scopes"
>;
type EmbeddedAgentCommandModule = typeof import("./agent.js");
type AgentSessionModule = typeof import("./agent/session.js");
type RuntimeConfigModule = typeof import("../config/io.js");
type AgentSessionModuleLoader = () => Promise<AgentSessionModule>;

const AGENT_CLI_SIGNALS: readonly AgentCliSignal[] = ["SIGINT", "SIGTERM"];
const GATEWAY_ABORT_RETRY_DELAYS_MS = [50, 150, 300, 600] as const;
const GATEWAY_ABORT_REQUEST_TIMEOUT_MS = 2_000;
const AGENT_CLI_SIGNAL_EXIT_CODES: Record<AgentCliSignal, number> = {
  SIGINT: 130,
  SIGTERM: 143,
};
const MESSAGE_FILE_DECODER = new TextDecoder("utf-8", { fatal: true });

let embeddedAgentCommandPromise: Promise<EmbeddedAgentCommandModule["agentCommand"]> | undefined;
let agentSessionModulePromise: Promise<AgentSessionModule> | undefined;
let runtimeConfigModulePromise: Promise<RuntimeConfigModule> | undefined;
let replyPayloadModulePromise:
  | Promise<typeof import("quiet-core-bot/plugin-sdk/reply-payload")>
  | undefined;
const defaultAgentSessionModuleLoader: AgentSessionModuleLoader = () =>
  import("./agent/session.js");
let agentSessionModuleLoader: AgentSessionModuleLoader = defaultAgentSessionModuleLoader;
let gatewayAbortRetryDelaysMsForTests: readonly number[] | undefined;

function resolveGatewayAbortRetryDelaysMs(): readonly number[] {
  return gatewayAbortRetryDelaysMsForTests ?? GATEWAY_ABORT_RETRY_DELAYS_MS;
}

function loadEmbeddedAgentCommand(): Promise<EmbeddedAgentCommandModule["agentCommand"]> {
  embeddedAgentCommandPromise ??= import("./agent.js").then((module) => module.agentCommand);
  return embeddedAgentCommandPromise;
}

function loadAgentSessionModule(): Promise<AgentSessionModule> {
  agentSessionModulePromise ??= agentSessionModuleLoader();
  return agentSessionModulePromise;
}

async function loadRuntimeConfig(): Promise<OpenClawConfig> {
  runtimeConfigModulePromise ??= import("../config/io.js");
  const { getRuntimeConfig } = await runtimeConfigModulePromise;
  return getRuntimeConfig();
}

function loadReplyPayloadModule() {
  replyPayloadModulePromise ??= import("quiet-core-bot/plugin-sdk/reply-payload");
  return replyPayloadModulePromise;
}

type PendingExecApprovalLookup = () => Promise<readonly unknown[]>;

async function defaultPendingExecApprovalLookup(): Promise<readonly unknown[]> {
  const { callGatewayFromCli } = await import("../cli/gateway-rpc.js");
  const raw = await callGatewayFromCli("exec.approval.list", {}, {});
  return Array.isArray(raw) ? raw : [];
}

let pendingExecApprovalLookup: PendingExecApprovalLookup = defaultPendingExecApprovalLookup;
const PENDING_EXEC_APPROVAL_HINT_RETRY_DELAYS_MS = [500, 1_500, 3_000] as const;
const PENDING_EXEC_APPROVAL_WATCH_INTERVAL_MS = 45_000;
let pendingExecApprovalHintRetryDelaysMsForTests: readonly number[] | undefined;
let pendingExecApprovalWatchIntervalMsForTests: number | undefined;

function resolvePendingExecApprovalHintRetryDelaysMs(): readonly number[] {
  return pendingExecApprovalHintRetryDelaysMsForTests ?? PENDING_EXEC_APPROVAL_HINT_RETRY_DELAYS_MS;
}

function resolvePendingExecApprovalWatchIntervalMs(): number {
  return pendingExecApprovalWatchIntervalMsForTests ?? PENDING_EXEC_APPROVAL_WATCH_INTERVAL_MS;
}

/** Test-only hooks for resetting lazy imports and shortening retry timing. */
export const agentViaGatewayTesting = {
  resetLazyImportsForTests(): void {
    embeddedAgentCommandPromise = undefined;
    agentSessionModulePromise = undefined;
    runtimeConfigModulePromise = undefined;
    replyPayloadModulePromise = undefined;
    agentSessionModuleLoader = defaultAgentSessionModuleLoader;
  },
  setAgentSessionModuleLoaderForTests(loader: AgentSessionModuleLoader): void {
    agentSessionModulePromise = undefined;
    agentSessionModuleLoader = loader;
  },
  setPendingExecApprovalLookupForTests(lookup?: PendingExecApprovalLookup): void {
    pendingExecApprovalLookup = lookup ?? defaultPendingExecApprovalLookup;
  },
  setPendingExecApprovalHintRetryDelaysMsForTests(delays?: readonly number[]): void {
    pendingExecApprovalHintRetryDelaysMsForTests = delays;
  },
  setPendingExecApprovalWatchIntervalMsForTests(intervalMs?: number): void {
    pendingExecApprovalWatchIntervalMsForTests = intervalMs;
  },
  resolveGatewayAgentTimeoutMs,
  setGatewayAbortRetryDelaysMsForTests(delays?: readonly number[]): void {
    gatewayAbortRetryDelaysMsForTests = delays;
  },
};

function protectJsonStdout(opts: Pick<AgentCliOpts, "json">): void {
  if (opts.json === true) {
    routeLogsToStderr();
  }
}

function missingAgentMessageError(): Error {
  return new Error(
    `Missing message. Use ${formatCliCommand('quiet-core-bot agent --message "..." --agent <id>')} or ${formatCliCommand("quiet-core-bot agent --message-file <path> --agent <id>")}.`,
  );
}

function formatMessageFileReadFailure(messageFile: string, err: unknown): string {
  const code =
    typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : "";
  if (code === "ENOENT") {
    return `Message file not found: ${messageFile}`;
  }
  if (code === "EISDIR") {
    return `Message file is a directory: ${messageFile}`;
  }
  const message = err instanceof Error ? err.message : String(err);
  return `Unable to read message file ${messageFile}: ${message}`;
}

async function readAgentMessageFile(messageFile: string): Promise<string> {
  let buffer: Buffer;
  try {
    buffer = await readFile(messageFile);
  } catch (err) {
    throw new Error(formatMessageFileReadFailure(messageFile, err), { cause: err });
  }
  try {
    return MESSAGE_FILE_DECODER.decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    throw new Error(`Message file must be valid UTF-8: ${messageFile}`);
  }
}

async function resolveAgentMessageOpts(opts: AgentCliOpts): Promise<AgentDispatchOpts> {
  const { messageFile: rawMessageFile, ...rest } = opts;
  const messageFile = rawMessageFile?.trim();
  const hasInlineMessage = opts.message !== undefined;
  if (hasInlineMessage && messageFile) {
    throw new Error("Use either --message or --message-file, not both.");
  }
  if (rawMessageFile !== undefined && !messageFile) {
    throw new Error("--message-file must not be empty.");
  }
  if (messageFile) {
    const message = await readAgentMessageFile(messageFile);
    if (!message.trim()) {
      throw new Error(`Message file is empty: ${messageFile}`);
    }
    return { ...rest, message };
  }
  const message = opts.message ?? "";
  if (!message.trim()) {
    throw missingAgentMessageError();
  }
  return { ...rest, message };
}

function parseTimeoutSeconds(opts: { cfg: OpenClawConfig; timeout?: string }) {
  const raw =
    opts.timeout !== undefined
      ? parseStrictNonNegativeInteger(opts.timeout)
      : (opts.cfg.agents?.defaults?.timeoutSeconds ?? 600);
  if (raw === undefined) {
    throw new Error(
      `Invalid --timeout. Use seconds as a non-negative integer, for example --timeout 600. Use --timeout 0 to disable the timeout.`,
    );
  }
  return raw;
}

function resolveGatewayAgentTimeoutMs(timeoutSeconds: number): number {
  if (timeoutSeconds === 0) {
    return NO_GATEWAY_TIMEOUT_MS;
  }
  return resolveTimerTimeoutMs((timeoutSeconds + 30) * 1000, 10_000, 10_000);
}

async function getGatewayDispatchConfig(options?: {
  skipShellEnvFallback?: boolean;
}): Promise<OpenClawConfig> {
  // Scoped gateway turns need core agent/session/gateway fields only. The
  // running gateway owns plugin validation and plugin metadata freshness.
  if (options?.skipShellEnvFallback === false) {
    return await readGatewayDispatchConfigWithShellEnvFallback();
  }
  return readGatewayDispatchConfig();
}

async function formatPayloadForLog(payload: {
  text?: string;
  mediaUrls?: string[];
  mediaUrl?: string | null;
}) {
  const { resolveSendableOutboundReplyParts } = await loadReplyPayloadModule();
  const parts = resolveSendableOutboundReplyParts({
    text: payload.text,
    mediaUrls: payload.mediaUrls,
    mediaUrl: typeof payload.mediaUrl === "string" ? payload.mediaUrl : undefined,
  });
  const lines: string[] = [];
  if (parts.text) {
    lines.push(parts.text.trimEnd());
  }
  for (const url of parts.mediaUrls) {
    lines.push(`Attachment: ${url}`);
  }
  return lines.join("\n").trimEnd();
}

function isGatewayAgentTimeoutError(err: unknown): boolean {
  if (isGatewayTransportError(err)) {
    return err.kind === "timeout";
  }
  return err instanceof Error && err.message.includes("gateway request timeout for agent");
}

function isCompactControlCommand(message: string): boolean {
  return /^\/compact(?:\s|:|$)/iu.test(message.trim());
}

function isSessionResetCommand(message: string): boolean {
  return /^\/(?:new|reset)(?:\s|$)/i.test(message.trim());
}

function shouldRetryGatewayDispatchWithShellEnvFallback(err: unknown): boolean {
  return (
    isGatewayCredentialsRequiredError(err) ||
    isGatewayExplicitAuthRequiredError(err) ||
    isGatewaySecretRefUnavailableError(err)
  );
}

function isGatewayAgentEmbeddedFallbackError(err: unknown): boolean {
  return isGatewayTransportError(err);
}

function isTransientGatewayAgentConnectClose(err: unknown): boolean {
  if (!isGatewayTransportError(err) || err.kind !== "closed") {
    return false;
  }
  const code = typeof err.code === "number" ? err.code : undefined;
  const reason = normalizeOptionalString(err.reason);
  return code === 1000 && (!reason || reason === "no close reason");
}

function validateExplicitSessionKeyForDispatch(
  opts: Pick<AgentCliOpts, "agent" | "sessionKey">,
): void {
  const sessionKey = opts.sessionKey?.trim();
  if (!sessionKey) {
    return;
  }

  if (classifySessionKeyShape(sessionKey) === "malformed_agent") {
    throw new Error(
      `Invalid --session-key "${sessionKey}". Agent-prefixed session keys must use agent:<agent-id>:<session-key>.`,
    );
  }

  const agentIdRaw = opts.agent?.trim() || undefined;
  if (!agentIdRaw || classifySessionKeyShape(sessionKey) !== "agent") {
    return;
  }
  const agentId = normalizeAgentId(agentIdRaw);
  const sessionAgentId = resolveAgentIdFromSessionKey(sessionKey);
  if (sessionAgentId !== agentId) {
    throw new Error(
      `Agent id "${agentIdRaw}" does not match session key agent "${sessionAgentId}".`,
    );
  }
}

async function normalizeSessionKeyOptsForDispatch(
  opts: AgentDispatchOpts,
): Promise<AgentDispatchOpts> {
  const rawSessionKey = opts.sessionKey?.trim();
  const rawTo = opts.to?.trim();
  if (!rawSessionKey && !opts.sessionId?.trim() && classifySessionKeyShape(rawTo) === "agent") {
    return {
      ...opts,
      to: undefined,
      sessionKey: rawTo,
    };
  }
  const isLegacySessionKey =
    rawSessionKey && classifySessionKeyShape(rawSessionKey) === "legacy_or_alias";
  const agentIdRaw = opts.agent?.trim();
  const shouldScopeDefaultAgentKey =
    isLegacySessionKey && !agentIdRaw && !isUnscopedSessionKeySentinel(rawSessionKey);
  const cfg =
    isLegacySessionKey && (agentIdRaw || shouldScopeDefaultAgentKey)
      ? opts.local === true
        ? await loadRuntimeConfig()
        : await getGatewayDispatchConfig()
      : undefined;
  const sessionKey = scopeLegacySessionKeyToAgent({
    agentId: agentIdRaw ?? (shouldScopeDefaultAgentKey ? resolveDefaultAgentId(cfg!) : undefined),
    sessionKey: opts.sessionKey,
    mainKey: cfg?.session?.mainKey,
  });
  if (sessionKey === opts.sessionKey) {
    return opts;
  }
  return {
    ...opts,
    sessionKey,
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function readAcceptedRunContext(payload: unknown): {
  runId?: string;
  sessionKey?: string;
} {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const runId = (payload as { runId?: unknown }).runId;
  const sessionKey = (payload as { sessionKey?: unknown }).sessionKey;
  const status = (payload as { status?: unknown }).status;
  if (status !== "accepted") {
    return {};
  }
  return {
    runId: typeof runId === "string" && runId.trim() ? runId.trim() : undefined,
    sessionKey: typeof sessionKey === "string" && sessionKey.trim() ? sessionKey.trim() : undefined,
  };
}

function createAgentCliSignalBridge(processLike: AgentCliProcessLike = process) {
  const controller = new AbortController();
  let receivedSignal: AgentCliSignal | undefined;
  const handlers = new Map<AgentCliSignal, () => void>();
  const detachHandlers = () => {
    for (const [signal, handler] of handlers) {
      processLike.off(signal, handler);
    }
    handlers.clear();
  };
  for (const signal of AGENT_CLI_SIGNALS) {
    const handler = () => {
      receivedSignal = signal;
      if (!controller.signal.aborted) {
        // runtime.exit may bypass finally cleanup, so first-signal self-detach is load-bearing.
        controller.abort();
        detachHandlers();
      }
    };
    handlers.set(signal, handler);
    processLike.on(signal, handler);
  }
  return {
    signal: controller.signal,
    getReceivedSignal: () => receivedSignal,
    dispose: detachHandlers,
  };
}

function isAgentCliProcessLike(value: unknown): value is AgentCliProcessLike {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { on?: unknown }).on === "function" &&
    typeof (value as { off?: unknown }).off === "function"
  );
}

function resolveAgentCliProcessLike(deps: AgentCliDeps | undefined): AgentCliProcessLike {
  if (!deps || !Object.hasOwn(deps, "process")) {
    return process;
  }
  const processLike = (deps as { process?: unknown }).process;
  return isAgentCliProcessLike(processLike) ? processLike : process;
}

function createAbortDelayError(): Error {
  const err = new Error("gateway agent retry aborted");
  err.name = "AbortError";
  return err;
}

function delayMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortDelayError());
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortDelayError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isConfirmedChatAbortResponseForRun(value: unknown, runId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const response = value as { aborted?: unknown; runIds?: unknown };
  if (response.aborted !== true) {
    return false;
  }
  if (response.runIds === undefined) {
    return true;
  }
  return Array.isArray(response.runIds) && response.runIds.includes(runId);
}

async function abortAcceptedGatewayAgentRunWithRequest(params: {
  runId: string | undefined;
  sessionKey: string | undefined;
  signal: AgentCliSignal | undefined;
  runtime: RuntimeEnv;
  request: GatewayRequestFunction;
  logFailure?: boolean;
}): Promise<boolean> {
  if (!params.signal || !params.runId || !params.sessionKey) {
    return false;
  }
  try {
    const response = await params.request(
      "chat.abort",
      {
        sessionKey: params.sessionKey,
        runId: params.runId,
      },
      { timeoutMs: GATEWAY_ABORT_REQUEST_TIMEOUT_MS },
    );
    if (isConfirmedChatAbortResponseForRun(response, params.runId)) {
      return true;
    }
    if (params.logFailure !== false) {
      params.runtime.error?.(
        `Interrupted by ${params.signal}; Gateway run ${params.runId} was not confirmed aborted.`,
      );
    }
    return false;
  } catch (err) {
    if (params.logFailure !== false) {
      params.runtime.error?.(
        `Interrupted by ${params.signal}; failed to abort Gateway run ${params.runId}: ${String(
          err,
        )}`,
      );
    }
    return false;
  }
}

async function abortAcceptedGatewayAgentRunWithGatewayCall(params: {
  runId: string | undefined;
  sessionKey: string | undefined;
  signal: AgentCliSignal | undefined;
  runtime: RuntimeEnv;
  gatewayIdentity: AgentGatewayCallIdentity;
  config: OpenClawConfig;
}): Promise<void> {
  const request: GatewayRequestFunction = async <T = Record<string, unknown>>(
    method: string,
    requestParams?: unknown,
    opts?: Parameters<GatewayRequestFunction>[2],
  ): Promise<T> =>
    await callGateway<T>({
      method,
      params: requestParams,
      timeoutMs: opts?.timeoutMs ?? undefined,
      expectFinal: opts?.expectFinal,
      config: params.config,
      ...params.gatewayIdentity,
    });
  const retryDelaysMs = resolveGatewayAbortRetryDelaysMs();
  for (const [attempt, retryDelayMs] of [...retryDelaysMs, 0].entries()) {
    const isFinalAttempt = attempt === retryDelaysMs.length;
    const aborted = await abortAcceptedGatewayAgentRunWithRequest({
      runId: params.runId,
      sessionKey: params.sessionKey,
      signal: params.signal,
      runtime: params.runtime,
      request,
      logFailure: isFinalAttempt,
    });
    if (aborted || isFinalAttempt) {
      return;
    }
    await delayMs(retryDelayMs);
  }
}

async function abortAcceptedGatewayAgentRunOnActiveConnection(params: {
  runId: string | undefined;
  sessionKey: string | undefined;
  signal: AgentCliSignal | undefined;
  runtime: RuntimeEnv;
  request: GatewayRequestFunction;
}): Promise<boolean> {
  const retryDelaysMs = resolveGatewayAbortRetryDelaysMs();
  for (const [attempt, retryDelayMs] of [...retryDelaysMs, 0].entries()) {
    const isFinalAttempt = attempt === retryDelaysMs.length;
    const aborted = await abortAcceptedGatewayAgentRunWithRequest({
      runId: params.runId,
      sessionKey: params.sessionKey,
      signal: params.signal,
      runtime: params.runtime,
      request: params.request,
      logFailure: false,
    });
    if (aborted || isFinalAttempt) {
      return aborted;
    }
    await delayMs(retryDelayMs);
  }
  return false;
}

function exitForReceivedSignal(signal: AgentCliSignal | undefined, runtime: RuntimeEnv): boolean {
  if (!signal) {
    return false;
  }
  runtime.exit(AGENT_CLI_SIGNAL_EXIT_CODES[signal]);
  return true;
}

function returnAfterSignalExit<T>(
  value: T,
  signal: AgentCliSignal | undefined,
  runtime: RuntimeEnv,
): T | undefined {
  return exitForReceivedSignal(signal, runtime) ? undefined : value;
}

function createGatewayTimeoutFallbackSessionId(): string {
  return `${GATEWAY_TIMEOUT_FALLBACK_SESSION_PREFIX}${randomUUID()}`;
}

function createGatewayTimeoutFallbackSession(agentId?: string): {
  sessionId: string;
  sessionKey: string;
} {
  const sessionId = createGatewayTimeoutFallbackSessionId();
  return {
    sessionId,
    sessionKey: `agent:${normalizeAgentId(agentId)}:explicit:${sessionId.trim()}`,
  };
}

async function resolveAgentIdForGatewayTimeoutFallback(
  opts: AgentDispatchOpts,
): Promise<string | undefined> {
  const explicitSessionKey = opts.sessionKey?.trim();
  if (classifySessionKeyShape(explicitSessionKey) === "agent") {
    return resolveAgentIdFromSessionKey(explicitSessionKey);
  }
  if (isUnscopedSessionKeySentinel(explicitSessionKey)) {
    return resolveDefaultAgentId(await getGatewayDispatchConfig());
  }

  const agentIdRaw = opts.agent?.trim();
  if (agentIdRaw) {
    return normalizeAgentId(agentIdRaw);
  }

  if (!opts.to && !opts.sessionId) {
    return undefined;
  }
  const cfg = await getGatewayDispatchConfig();
  const { resolveSessionKeyForRequest } = await loadAgentSessionModule();
  const resolvedSessionKey = resolveSessionKeyForRequest({
    cfg,
    to: opts.to,
    sessionId: opts.sessionId,
  }).sessionKey;
  return classifySessionKeyShape(resolvedSessionKey) === "agent"
    ? resolveAgentIdFromSessionKey(resolvedSessionKey)
    : undefined;
}

function buildGatewayJsonResponse(response: GatewayAgentResponse): GatewayAgentResponse {
  const deliveryStatus = response.result?.deliveryStatus;
  if (deliveryStatus === undefined) {
    return response;
  }
  return {
    ...response,
    deliveryStatus,
  };
}

function isInFlightGatewayAgentResponse(response: GatewayAgentResponse): boolean {
  return response.status === "in_flight";
}

function formatInFlightGatewayAgentMessage(response: GatewayAgentResponse): string {
  return response.runId
    ? `Agent run ${response.runId} is already in flight; not starting a duplicate run.`
    : "Agent run is already in flight; not starting a duplicate run.";
}

/**
 * Best-effort hint when a CLI turn ends while exec approvals are still pending.
 * Without it, a blocked turn only reports "aborted"/"timeout" while the only
 * resolution paths are the Web UI or a chat `/approve` route.
 */
async function reportPendingExecApprovalHint(params: {
  runtime: RuntimeEnv;
  sessionKey: string | undefined;
}): Promise<void> {
  const sessionKey = params.sessionKey?.trim();
  if (!sessionKey) {
    return;
  }
  try {
    let pending = await findPendingExecApprovalsForSession(sessionKey);
    for (const retryDelayMs of resolvePendingExecApprovalHintRetryDelaysMs()) {
      if (pending.length > 0) {
        break;
      }
      // A turn can abort while the gateway-side exec tool is still registering its
      // request (observed: the request landed a few seconds after the CLI exited),
      // so retry over a bounded window before staying silent.
      await delayMs(retryDelayMs);
      pending = await findPendingExecApprovalsForSession(sessionKey);
    }
    if (pending.length === 0) {
      return;
    }
    const ids = pending
      .map((entry) => String((entry as { id?: unknown }).id ?? "").slice(0, 8))
      .filter((value) => value.length > 0)
      .join(", ");
    params.runtime.error?.(
      `Blocked on ${pending.length} pending exec approval(s) for ${sessionKey}: ${ids}`,
    );
    params.runtime.error?.(
      "List with: quiet-core-bot approvals pending   Resolve with: quiet-core-bot approvals approve <id> | quiet-core-bot approvals deny <id>",
    );
  } catch {
    // Advisory only: never fail a turn because the pending-approval lookup failed.
  }
}

async function findPendingExecApprovalsForSession(sessionKey: string): Promise<readonly unknown[]> {
  const raw = await pendingExecApprovalLookup();
  return (Array.isArray(raw) ? raw : []).filter(
    (entry) => (entry as { request?: { sessionKey?: unknown } }).request?.sessionKey === sessionKey,
  );
}

/**
 * F1: while a gateway turn is in flight, report pending exec approvals on a
 * periodic tick.
 *
 * `reportPendingExecApprovalHint` only fires once the turn has already ended, so
 * a headless run that is blocked on an exec approval for 10+ minutes shows
 * nothing at all: no reply, no status, no hint that the operator's decision is
 * what unblocks it. This watcher makes that state visible while it lasts.
 */
function startPendingExecApprovalWatch(params: {
  runtime: RuntimeEnv;
  sessionKey: string | undefined;
  enabled: boolean;
}): () => void {
  const sessionKey = params.sessionKey?.trim();
  if (!params.enabled || !sessionKey) {
    return () => {};
  }
  let lookupInFlight = false;
  const timer = setInterval(() => {
    if (lookupInFlight) {
      return;
    }
    lookupInFlight = true;
    void (async () => {
      try {
        const pending = await findPendingExecApprovalsForSession(sessionKey);
        if (pending.length === 0) {
          return;
        }
        const ids = pending
          .map((entry) => String((entry as { id?: unknown }).id ?? "").slice(0, 8))
          .filter((value) => value.length > 0)
          .join(", ");
        params.runtime.error?.(
          `Still blocked on ${pending.length} pending exec approval(s) for ${sessionKey}: ${ids}`,
        );
        params.runtime.error?.(
          "List with: quiet-core-bot approvals pending   Resolve with: quiet-core-bot approvals approve <id> | quiet-core-bot approvals deny <id>",
        );
      } catch {
        // Advisory only: a pending-approval lookup must never fail a live turn.
      } finally {
        lookupInFlight = false;
      }
    })();
  }, resolvePendingExecApprovalWatchIntervalMs());
  timer.unref?.();
  return () => clearInterval(timer);
}

async function agentViaGatewayCommand(
  opts: AgentDispatchOpts,
  runtime: RuntimeEnv,
  signalBridge: ReturnType<typeof createAgentCliSignalBridge>,
) {
  protectJsonStdout(opts);
  const body = opts.message;
  const explicitSessionKey = opts.sessionKey?.trim();
  if (!body.trim()) {
    throw missingAgentMessageError();
  }
  if (!opts.to && !opts.sessionId && !opts.agent && !explicitSessionKey) {
    throw new Error(
      `No target session selected. Use --agent <id>, --session-key <key>, --session-id <id>, or --to <E.164>. Run ${formatCliCommand("quiet-core-bot agents list")} to see agents.`,
    );
  }

  let cfg = await getGatewayDispatchConfig();
  const agentIdRaw = opts.agent?.trim();
  const agentId = agentIdRaw ? normalizeAgentId(agentIdRaw) : undefined;
  if (agentId) {
    const knownAgents = listAgentIds(cfg);
    if (!knownAgents.includes(agentId)) {
      throw new Error(
        `Unknown agent id "${agentIdRaw}". Use "${formatCliCommand("quiet-core-bot agents list")}" to see configured agents.`,
      );
    }
  }
  const timeoutSeconds = parseTimeoutSeconds({ cfg, timeout: opts.timeout });
  const gatewayTimeoutMs = resolveGatewayAgentTimeoutMs(timeoutSeconds);

  const sessionKey =
    classifySessionKeyShape(explicitSessionKey) === "agent"
      ? explicitSessionKey
      : (await loadAgentSessionModule()).resolveSessionKeyForRequest({
          cfg,
          agentId,
          to: opts.to,
          sessionId: opts.sessionId,
          sessionKey: explicitSessionKey,
        }).sessionKey;

  const channel = normalizeMessageChannel(opts.channel);
  const idempotencyKey = normalizeOptionalString(opts.runId) || randomIdempotencyKey();
  const modelOverride = normalizeOptionalString(opts.model);
  const hasModelOverride = Boolean(modelOverride);
  const needsAdminGatewayIdentity = hasModelOverride || isSessionResetCommand(body);
  const gatewayIdentity: AgentGatewayCallIdentity = needsAdminGatewayIdentity
    ? {
        clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
        mode: GATEWAY_CLIENT_MODES.BACKEND,
        scopes: [ADMIN_SCOPE],
      }
    : {
        clientName: GATEWAY_CLIENT_NAMES.CLI,
        mode: GATEWAY_CLIENT_MODES.CLI,
      };

  let acceptedRunId: string | undefined = idempotencyKey;
  let acceptedSessionKey: string | undefined = sessionKey;
  let acceptedGatewayRun = false;
  let activeConnectionAbortAttempted = false;
  let activeConnectionAbortSucceeded = false;
  let response: GatewayAgentResponse | undefined;
  const dispatchGatewayAgentCall = async (activeCfg: OpenClawConfig) =>
    await withProgress(
      {
        label: "Waiting for agent reply…",
        indeterminate: true,
        enabled: opts.json !== true,
      },
      async () =>
        await callGateway({
          method: "agent",
          params: {
            message: body,
            agentId,
            model: modelOverride,
            to: opts.to,
            replyTo: opts.replyTo,
            sessionId: opts.sessionId,
            sessionKey,
            thinking: opts.thinking,
            deliver: Boolean(opts.deliver),
            channel,
            replyChannel: opts.replyChannel,
            replyAccountId: opts.replyAccount,
            bestEffortDeliver: opts.bestEffortDeliver,
            timeout: timeoutSeconds,
            lane: opts.lane,
            extraSystemPrompt: opts.extraSystemPrompt,
            cleanupBundleMcpOnRunEnd: true,
            idempotencyKey,
          },
          expectFinal: true,
          timeoutMs: gatewayTimeoutMs,
          config: activeCfg,
          signal: signalBridge.signal,
          onAccepted: (payload) => {
            acceptedGatewayRun = true;
            const accepted = readAcceptedRunContext(payload);
            acceptedRunId = accepted.runId ?? acceptedRunId;
            acceptedSessionKey = accepted.sessionKey ?? acceptedSessionKey;
          },
          onSignalAbort: async (request) => {
            activeConnectionAbortAttempted = true;
            activeConnectionAbortSucceeded = await abortAcceptedGatewayAgentRunOnActiveConnection({
              runId: acceptedRunId,
              sessionKey: acceptedSessionKey,
              signal: signalBridge.getReceivedSignal(),
              runtime,
              request,
            });
          },
          ...gatewayIdentity,
        }),
    );

  let shellEnvFallbackRetriesRemaining = 1;
  const consumeShellEnvFallbackRetry = () => shellEnvFallbackRetriesRemaining-- > 0;
  // F1: keep a long blocked turn visible instead of silent. `--json` runs must
  // keep stdout parseable, so the watcher is stderr-only and disabled there.
  const stopPendingExecApprovalWatch = startPendingExecApprovalWatch({
    runtime,
    sessionKey,
    enabled: opts.json !== true,
  });
  try {
    for (;;) {
      try {
        response = await dispatchGatewayAgentCall(cfg);
        break;
      } catch (err) {
        if (
          !acceptedGatewayRun &&
          shouldRetryGatewayDispatchWithShellEnvFallback(err) &&
          consumeShellEnvFallbackRetry()
        ) {
          cfg = await getGatewayDispatchConfig({ skipShellEnvFallback: false });
          continue;
        }
        if (
          isAbortError(err) &&
          !activeConnectionAbortSucceeded &&
          (acceptedGatewayRun || activeConnectionAbortAttempted)
        ) {
          await abortAcceptedGatewayAgentRunWithGatewayCall({
            runId: acceptedRunId,
            sessionKey: acceptedSessionKey,
            signal: signalBridge.getReceivedSignal(),
            runtime,
            gatewayIdentity,
            config: cfg,
          });
        }
        throw err;
      }
    }
  } finally {
    stopPendingExecApprovalWatch();
  }
  if (!response) {
    throw new Error("gateway agent call did not return a response");
  }

  if (opts.json) {
    writeRuntimeJson(runtime, buildGatewayJsonResponse(response));
    return response;
  }

  const result = response?.result;
  const payloads = result?.payloads ?? [];

  if (isInFlightGatewayAgentResponse(response)) {
    runtime.error?.(formatInFlightGatewayAgentMessage(response));
    return response;
  }

  if (payloads.length === 0) {
    if (response?.status !== "ok") {
      runtime.log(response?.summary ? response.summary : "No reply from agent.");
      await reportPendingExecApprovalHint({ runtime, sessionKey });
    }
    return response;
  }

  for (const payload of payloads) {
    const out = await formatPayloadForLog(payload);
    if (out) {
      runtime.log(out);
    }
  }

  return response;
}

async function agentViaGatewayCommandWithTransientRetries(
  opts: AgentDispatchOpts,
  runtime: RuntimeEnv,
  signalBridge: ReturnType<typeof createAgentCliSignalBridge>,
) {
  for (const [attempt, retryDelayMs] of [
    ...GATEWAY_TRANSIENT_CONNECT_RETRY_DELAYS_MS,
    0,
  ].entries()) {
    try {
      return await agentViaGatewayCommand(opts, runtime, signalBridge);
    } catch (err) {
      if (isAbortError(err)) {
        throw err;
      }
      const isFinalAttempt = attempt === GATEWAY_TRANSIENT_CONNECT_RETRY_DELAYS_MS.length;
      if (isFinalAttempt || !isTransientGatewayAgentConnectClose(err)) {
        throw err;
      }
      runtime.error?.(
        `Gateway agent connection closed during handshake; retrying in ${retryDelayMs}ms before embedded fallback.`,
      );
      await delayMs(retryDelayMs, signalBridge.signal);
    }
  }
  throw new Error("Gateway agent retry loop exhausted unexpectedly.");
}

export async function agentCliCommand(
  opts: AgentCliOpts,
  runtime: RuntimeEnv,
  deps?: AgentCliDeps,
) {
  protectJsonStdout(opts);
  const messageOpts = await resolveAgentMessageOpts(opts);
  // `/compact` cannot run as a plain CLI agent turn: the slash-command handler
  // rejects CLI-originated senders, so the message would fall through to a
  // normal turn and exit 0 without compacting anything (issue #90640 Gap B).
  // Fail loudly and point at the first-class command instead of no-opping.
  if (isCompactControlCommand(messageOpts.message)) {
    runtime.error?.(
      "Slash commands cannot be executed via --message from the CLI. Use: quiet-core-bot sessions compact <key>",
    );
    runtime.exit(1);
    return undefined;
  }
  const dispatchOpts = await normalizeSessionKeyOptsForDispatch(messageOpts);
  validateExplicitSessionKeyForDispatch(dispatchOpts);
  const gatewayDispatchOpts: AgentDispatchOpts & { runId: string } = dispatchOpts.runId
    ? { ...dispatchOpts, runId: dispatchOpts.runId }
    : { ...dispatchOpts, runId: randomIdempotencyKey() };
  const signalBridge = createAgentCliSignalBridge(resolveAgentCliProcessLike(deps));
  const localOpts = {
    ...gatewayDispatchOpts,
    agentId: gatewayDispatchOpts.agent,
    replyAccountId: gatewayDispatchOpts.replyAccount,
    cleanupBundleMcpOnRunEnd: true,
    cleanupCliLiveSessionOnRunEnd: true,
    oneShotCliRun: dispatchOpts.local === true,
    abortSignal: signalBridge.signal,
  };
  try {
    if (dispatchOpts.local === true) {
      const agentCommand = await loadEmbeddedAgentCommand();
      const result = await agentCommand(localOpts, runtime, deps);
      return returnAfterSignalExit(result, signalBridge.getReceivedSignal(), runtime);
    }

    try {
      const result = await agentViaGatewayCommandWithTransientRetries(
        gatewayDispatchOpts,
        runtime,
        signalBridge,
      );
      return returnAfterSignalExit(result, signalBridge.getReceivedSignal(), runtime);
    } catch (err) {
      if (isAbortError(err)) {
        if (exitForReceivedSignal(signalBridge.getReceivedSignal(), runtime)) {
          return undefined;
        }
        throw err;
      }
      if (isGatewayAgentTimeoutError(err)) {
        const fallbackAgentId = await resolveAgentIdForGatewayTimeoutFallback(dispatchOpts);
        const fallbackSession = createGatewayTimeoutFallbackSession(fallbackAgentId);
        warnBeforeEmbeddedFallback({
          runtime,
          runId: gatewayDispatchOpts.runId,
          reason: "gateway_timeout",
          err,
        });
        await recordEmbeddedFallback({
          runId: gatewayDispatchOpts.runId,
          reason: "gateway_timeout",
          error: err,
          sessionKey: fallbackSession.sessionKey,
          sessionId: fallbackSession.sessionId,
          fallbackRunId: fallbackSession.sessionId,
        });
        const agentCommand = await loadEmbeddedAgentCommand();
        const result = await agentCommand(
          {
            ...localOpts,
            sessionId: fallbackSession.sessionId,
            sessionKey: fallbackSession.sessionKey,
            runId: fallbackSession.sessionId,
            resultMetaOverrides: {
              ...EMBEDDED_FALLBACK_META,
              fallbackReason: "gateway_timeout",
              fallbackSessionId: fallbackSession.sessionId,
              fallbackSessionKey: fallbackSession.sessionKey,
            },
          },
          runtime,
          deps,
        );
        return returnAfterSignalExit(result, signalBridge.getReceivedSignal(), runtime);
      }

      if (!isGatewayAgentEmbeddedFallbackError(err)) {
        throw err;
      }

      warnBeforeEmbeddedFallback({
        runtime,
        runId: gatewayDispatchOpts.runId,
        reason: "gateway_failure",
        err,
      });
      await recordEmbeddedFallback({
        runId: gatewayDispatchOpts.runId,
        reason: "gateway_failure",
        error: err,
        ...(localOpts.sessionKey ? { sessionKey: localOpts.sessionKey } : {}),
        ...(localOpts.sessionId ? { sessionId: localOpts.sessionId } : {}),
      });
      const agentCommand = await loadEmbeddedAgentCommand();
      const result = await agentCommand(
        {
          ...localOpts,
          resultMetaOverrides: EMBEDDED_FALLBACK_META,
        },
        runtime,
        deps,
      );
      return returnAfterSignalExit(result, signalBridge.getReceivedSignal(), runtime);
    }
  } catch (err) {
    if (isAbortError(err) && exitForReceivedSignal(signalBridge.getReceivedSignal(), runtime)) {
      return undefined;
    }
    throw err;
  } finally {
    signalBridge.dispose();
  }
}
