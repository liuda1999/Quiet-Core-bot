/**
 * @deprecated Legacy compat surface for external plugins that still depend on
 * older broad plugin-sdk imports. Use focused quiet-core-bot/plugin-sdk subpaths
 * instead.
 */

import {
  createChannelReplyPipeline as createChannelReplyPipelineCompat,
  createReplyPrefixContext as createReplyPrefixContextCompat,
  createReplyPrefixOptions as createReplyPrefixOptionsCompat,
  createTypingCallbacks as createTypingCallbacksCompat,
  resolveChannelSourceReplyDeliveryMode as resolveChannelSourceReplyDeliveryModeCompat,
  type ChannelReplyPipeline as ChannelReplyPipelineCompat,
  type CreateTypingCallbacksParams as CreateTypingCallbacksParamsCompat,
  type ReplyPrefixContext as ReplyPrefixContextCompat,
  type ReplyPrefixContextBundle as ReplyPrefixContextBundleCompat,
  type ReplyPrefixOptions as ReplyPrefixOptionsCompat,
  type SourceReplyDeliveryMode as SourceReplyDeliveryModeCompat,
  type TypingCallbacks as TypingCallbacksCompat,
} from "./channel-reply-core.js";

const shouldWarnCompatImport =
  process.env.VITEST !== "true" &&
  process.env.NODE_ENV !== "test" &&
  process.env.QUIET_CORE_SUPPRESS_PLUGIN_SDK_COMPAT_WARNING !== "1";

if (shouldWarnCompatImport) {
  process.emitWarning(
    "quiet-core-bot/plugin-sdk/compat is deprecated for new plugins. Migrate to focused quiet-core-bot/plugin-sdk/<subpath> imports. See https://github.com/liuda1999/Quiet-Core-bot/plugins/sdk-migration",
    {
      code: "QUIET_CORE_PLUGIN_SDK_COMPAT_DEPRECATED",
      detail:
        "Bundled plugins must use scoped plugin-sdk subpaths. External plugins may keep compat temporarily while migrating. Migration guide: https://github.com/liuda1999/Quiet-Core-bot/plugins/sdk-migration",
    },
  );
}

export { emptyPluginConfigSchema } from "../plugins/config-schema.js";
export type {
  MemoryPluginCapability,
  MemoryPluginPublicArtifact,
  MemoryPluginPublicArtifactsProvider,
} from "../plugins/memory-state.js";
export { resolveControlCommandGate } from "../channels/command-gating.js";
export {
  buildMemorySystemPromptAddition,
  delegateCompactionToRuntime,
} from "../context-engine/delegate.js";
export { registerContextEngine } from "../context-engine/registry.js";
export type { DiagnosticEventPayload } from "../infra/diagnostic-events.js";
export { onDiagnosticEvent } from "../infra/diagnostic-events.js";
export { optionalStringEnum, stringEnum } from "../agents/schema/typebox.js";
export {
  applyAuthProfileConfig,
  buildApiKeyCredential,
  upsertApiKeyProfile,
  writeOAuthCredentials,
  type ApiKeyStorageOptions,
  type WriteOAuthCredentialsOptions,
} from "../plugins/provider-auth-helpers.js";

export { createAccountStatusSink } from "./channel-lifecycle.core.js";
export { createPluginRuntimeStore } from "./runtime-store.js";
export { KeyedAsyncQueue } from "./keyed-async-queue.js";
export { normalizeAccountId } from "./account-id.js";
export { resolvePreferredOpenClawTmpDir } from "./temp-path.js";

export {
  createHybridChannelConfigAdapter,
  createHybridChannelConfigBase,
  createScopedAccountConfigAccessors,
  createScopedChannelConfigAdapter,
  createScopedChannelConfigBase,
  createScopedDmSecurityResolver,
  createTopLevelChannelConfigAdapter,
  createTopLevelChannelConfigBase,
  mapAllowFromEntries,
} from "./channel-config-helpers.js";
export { formatAllowFromLowercase, formatNormalizedAllowFromEntries } from "./allow-from.js";
export * from "./channel-config-schema.js";
export * from "./channel-policy.js";
export { collectOpenGroupPolicyConfiguredRouteWarnings } from "./channel-policy.js";
export * from "./reply-history.js";
export * from "./directory-runtime.js";
export { mapAllowlistResolutionInputs } from "./allow-from.js";

/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export const createChannelReplyPipeline = createChannelReplyPipelineCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export const createReplyPrefixContext = createReplyPrefixContextCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export const createReplyPrefixOptions = createReplyPrefixOptionsCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export const createTypingCallbacks = createTypingCallbacksCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export const resolveChannelSourceReplyDeliveryMode = resolveChannelSourceReplyDeliveryModeCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export type ChannelReplyPipeline = ChannelReplyPipelineCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export type CreateTypingCallbacksParams = CreateTypingCallbacksParamsCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export type ReplyPrefixContext = ReplyPrefixContextCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export type ReplyPrefixContextBundle = ReplyPrefixContextBundleCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export type ReplyPrefixOptions = ReplyPrefixOptionsCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export type SourceReplyDeliveryMode = SourceReplyDeliveryModeCompat;
/** @deprecated Use `quiet-core-bot/plugin-sdk/channel-outbound`. */
export type TypingCallbacks = TypingCallbacksCompat;
