// Gateway HTTP request helpers.
// Resolves OpenAI-compatible agent/model/session headers and re-exports auth helpers.
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "@quiet-core/normalization-core/string-coerce";
import { listAgentIds, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { modelKey, parseModelRef, resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { createModelVisibilityPolicy } from "../agents/model-visibility-policy.js";
import { getRuntimeConfig } from "../config/io.js";
import { loadManifestMetadataSnapshot } from "../plugins/manifest-contract-eligibility.js";
import {
  buildAgentMainSessionKey,
  isAcpSessionKey,
  isCronSessionKey,
  isSubagentSessionKey,
  isValidAgentId,
  normalizeAgentId,
} from "../routing/session-key.js";
import { normalizeMessageChannel } from "../utils/message-channel.js";
import { getHeader } from "./http-auth-utils.js";
import { loadGatewayModelCatalog } from "./server-model-catalog.js";

export {
  authorizeOpenAiCompatibleHttpModelOverride,
  authorizeGatewayHttpRequestOrReply,
  authorizeScopedGatewayHttpRequestOrReply,
  checkGatewayHttpRequestAuth,
  getBearerToken,
  getHeader,
  isGatewayBearerHttpRequest,
  resolveHttpBrowserOriginPolicy,
  resolveHttpSenderIsOwner,
  resolveOpenAiCompatibleHttpOperatorScopes,
  resolveOpenAiCompatibleHttpSenderIsOwner,
  resolveSharedSecretHttpOperatorScopes,
  resolveTrustedHttpOperatorScopes,
  type AuthorizedGatewayHttpRequest,
  type GatewayHttpRequestAuthCheckResult,
} from "./http-auth-utils.js";

export const QUIET_CORE_MODEL_ID = "quiet-core-bot";
/** Default OpenAI-compatible model alias that targets the default Quiet Core bot agent. */
export const QUIET_CORE_DEFAULT_MODEL_ID = "quiet-core-bot/default";

export class UnknownGatewayAgentError extends Error {
  constructor(readonly agentId: string) {
    super(`Unknown agent '${agentId}'.`);
    this.name = "UnknownGatewayAgentError";
  }
}

export class GatewaySessionKeyOverrideError extends Error {
  constructor() {
    super("`x-quiet-core-bot-session-key` cannot use reserved internal session namespaces.");
    this.name = "GatewaySessionKeyOverrideError";
  }
}

export function isUnknownGatewayAgentError(err: unknown): err is UnknownGatewayAgentError {
  return err instanceof UnknownGatewayAgentError;
}

export function isGatewaySessionKeyOverrideError(
  err: unknown,
): err is GatewaySessionKeyOverrideError {
  return err instanceof GatewaySessionKeyOverrideError;
}

function assertKnownAgentId(agentId: string, cfg = getRuntimeConfig()): void {
  if (!listAgentIds(cfg).includes(agentId)) {
    throw new UnknownGatewayAgentError(agentId);
  }
}

function resolveAgentIdFromHeader(req: IncomingMessage): string | undefined {
  const raw =
    normalizeOptionalString(getHeader(req, "x-quiet-core-bot-agent-id")) ||
    normalizeOptionalString(getHeader(req, "x-quiet-core-bot-agent")) ||
    "";
  if (!raw) {
    return undefined;
  }
  if (!isValidAgentId(raw)) {
    throw new UnknownGatewayAgentError(raw);
  }
  return normalizeAgentId(raw);
}

/** Resolves the target agent encoded by an OpenAI-compatible model id. */
export function resolveAgentIdFromModel(
  model: string | undefined,
  cfg = getRuntimeConfig(),
): string | undefined {
  const raw = model?.trim();
  if (!raw) {
    return undefined;
  }
  const lowered = normalizeLowercaseStringOrEmpty(raw);
  if (lowered === QUIET_CORE_MODEL_ID || lowered === QUIET_CORE_DEFAULT_MODEL_ID) {
    return resolveDefaultAgentId(cfg);
  }

  const m =
    raw.match(/^quiet-core-bot[:/](?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i) ??
    raw.match(/^agent:(?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i);
  const agentId = m?.groups?.agentId;
  if (!agentId) {
    return undefined;
  }
  return normalizeAgentId(agentId);
}

/**
 * Canonical invalid-`model` guidance shared by the OpenAI-compatible routes.
 * Exported so the embeddings route cannot drift back to the pre-rename product
 * name the way it did before (`Use \`openclaw\`` while this route said
 * `quiet-core-bot`).
 */
export const OPENAI_COMPAT_INVALID_MODEL_MESSAGE =
  "Invalid `model`. Use `quiet-core-bot` or `quiet-core-bot/<agentId>`.";

/** Validates and resolves the `x-quiet-core-bot-model` override for OpenAI-compatible requests. */
export async function resolveOpenAiCompatModelOverride(params: {
  req: IncomingMessage;
  agentId: string;
  model: string | undefined;
}): Promise<{ modelOverride?: string; errorMessage?: string }> {
  const requestModel = params.model?.trim();
  if (requestModel && !resolveAgentIdFromModel(requestModel)) {
    return {
      errorMessage: OPENAI_COMPAT_INVALID_MODEL_MESSAGE,
    };
  }

  const raw = getHeader(params.req, "x-quiet-core-bot-model")?.trim();
  if (!raw) {
    return {};
  }

  const cfg = getRuntimeConfig();
  const defaultModelRef = resolveDefaultModelForAgent({ cfg, agentId: params.agentId });
  const defaultProvider = defaultModelRef.provider;
  const manifestMetadataSnapshot = loadManifestMetadataSnapshot({
    config: cfg,
    env: process.env,
  });
  const modelManifestContext = {
    manifestPlugins: manifestMetadataSnapshot.plugins,
  };
  const parsed = parseModelRef(raw, defaultProvider, {
    allowManifestNormalization: true,
    allowPluginNormalization: true,
    ...modelManifestContext,
  });
  if (!parsed) {
    return { errorMessage: "Invalid `x-quiet-core-bot-model`." };
  }

  // Overrides must pass the same visibility policy as model picker surfaces;
  // otherwise API clients could target hidden plugin/provider models by header.
  const catalog = await loadGatewayModelCatalog();
  const policy = createModelVisibilityPolicy({
    cfg,
    catalog,
    defaultProvider,
    agentId: params.agentId,
    allowManifestNormalization: true,
    allowPluginNormalization: true,
    ...modelManifestContext,
  });
  const normalized = modelKey(parsed.provider, parsed.model);
  if (!policy.allowsKey(normalized)) {
    return {
      errorMessage: `Model '${normalized}' is not allowed for agent '${params.agentId}'.`,
    };
  }

  return { modelOverride: raw };
}

/** Resolves the request agent from headers, model alias, or the configured default. */
export function resolveAgentIdForRequest(params: {
  req: IncomingMessage;
  model: string | undefined;
}): string {
  const cfg = getRuntimeConfig();
  const fromHeader = resolveAgentIdFromHeader(params.req);
  if (fromHeader) {
    assertKnownAgentId(fromHeader, cfg);
    return fromHeader;
  }

  const fromModel = resolveAgentIdFromModel(params.model, cfg);
  if (fromModel) {
    assertKnownAgentId(fromModel, cfg);
    return fromModel;
  }

  return resolveDefaultAgentId(cfg);
}

function resolveSessionKey(params: {
  req: IncomingMessage;
  agentId: string;
  user?: string | undefined;
  prefix: string;
}): string {
  const explicit = getHeader(params.req, "x-quiet-core-bot-session-key")?.trim();
  if (explicit) {
    if (isReservedSessionKeyOverride(explicit)) {
      throw new GatewaySessionKeyOverrideError();
    }
    return explicit;
  }

  const user = params.user?.trim();
  const mainKey = user ? `${params.prefix}-user:${user}` : `${params.prefix}:${randomUUID()}`;
  return buildAgentMainSessionKey({ agentId: params.agentId, mainKey });
}

function isReservedSessionKeyOverride(sessionKey: string): boolean {
  const lowered = normalizeLowercaseStringOrEmpty(sessionKey);
  return (
    lowered.startsWith("subagent:") ||
    lowered.startsWith("cron:") ||
    lowered.startsWith("acp:") ||
    isSubagentSessionKey(sessionKey) ||
    isCronSessionKey(sessionKey) ||
    isAcpSessionKey(sessionKey)
  );
}

/** Resolves gateway agent/session/channel context for OpenAI-compatible handlers. */
export function resolveGatewayRequestContext(params: {
  req: IncomingMessage;
  model: string | undefined;
  user?: string | undefined;
  sessionPrefix: string;
  defaultMessageChannel: string;
  useMessageChannelHeader?: boolean;
}): { agentId: string; sessionKey: string; messageChannel: string } {
  const agentId = resolveAgentIdForRequest({ req: params.req, model: params.model });
  const sessionKey = resolveSessionKey({
    req: params.req,
    agentId,
    user: params.user,
    prefix: params.sessionPrefix,
  });

  const messageChannel = params.useMessageChannelHeader
    ? (normalizeMessageChannel(getHeader(params.req, "x-quiet-core-bot-message-channel")) ??
      params.defaultMessageChannel)
    : params.defaultMessageChannel;

  return { agentId, sessionKey, messageChannel };
}
