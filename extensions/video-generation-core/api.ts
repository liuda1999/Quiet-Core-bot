// Video Generation Core API module exposes the plugin public contract.
export type { AuthProfileStore } from "quiet-core-bot/plugin-sdk/video-generation-core";
export {
  buildNoCapabilityModelConfiguredMessage,
  createSubsystemLogger,
  describeFailoverError,
  getProviderEnvVars,
  getVideoGenerationProvider,
  isFailoverError,
  listVideoGenerationProviders,
  parseVideoGenerationModelRef,
  resolveAgentModelFallbackValues,
  resolveAgentModelPrimaryValue,
  resolveCapabilityModelCandidates,
  throwCapabilityGenerationFailure,
} from "quiet-core-bot/plugin-sdk/video-generation-core";
export type {
  FallbackAttempt,
  GeneratedVideoAsset,
  QuietCoreConfig,
  VideoGenerationIgnoredOverride,
  VideoGenerationMode,
  VideoGenerationModeCapabilities,
  VideoGenerationProvider,
  VideoGenerationProviderCapabilities,
  VideoGenerationProviderConfiguredContext,
  VideoGenerationProviderPlugin,
  VideoGenerationRequest,
  VideoGenerationResolution,
  VideoGenerationResult,
  VideoGenerationSourceAsset,
  VideoGenerationTransformCapabilities,
} from "quiet-core-bot/plugin-sdk/video-generation-core";
