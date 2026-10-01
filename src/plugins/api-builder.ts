// Builds plugin API objects from config, registries, and runtime helpers.
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import { attachPluginApiFacades, type QuietCorePluginApiWithoutFacades } from "./api-facades.js";
import type { PluginRuntime } from "./runtime/types.js";
import type { QuietCorePluginApi, PluginLogger } from "./types.js";

export type BuildPluginApiParams = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir?: string;
  registrationMode: QuietCorePluginApi["registrationMode"];
  config: QuietCoreConfig;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  resolvePath: (input: string) => string;
  handlers?: Partial<
    Pick<
      QuietCorePluginApi,
      | "registerTool"
      | "registerHook"
      | "registerHttpRoute"
      | "registerHostedMediaResolver"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerCli"
      | "registerReload"
      | "registerNodeHostCommand"
      | "registerNodeInvokePolicy"
      | "registerSecurityAuditCollector"
      | "registerService"
      | "registerGatewayDiscoveryService"
      | "registerCliBackend"
      | "registerTextTransforms"
      | "registerConfigMigration"
      | "registerMigrationProvider"
      | "registerAutoEnableProbe"
      | "registerProvider"
      | "registerModelCatalogProvider"
      | "registerEmbeddingProvider"
      | "registerSpeechProvider"
      | "registerRealtimeTranscriptionProvider"
      | "registerRealtimeVoiceProvider"
      | "registerMediaUnderstandingProvider"
      | "registerTranscriptSourceProvider"
      | "registerImageGenerationProvider"
      | "registerVideoGenerationProvider"
      | "registerMusicGenerationProvider"
      | "registerWebFetchProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerCompactionProvider"
      | "registerAgentHarness"
      | "registerCodexAppServerExtensionFactory"
      | "registerAgentToolResultMiddleware"
      | "registerSessionExtension"
      | "enqueueNextTurnInjection"
      | "registerTrustedToolPolicy"
      | "registerToolMetadata"
      | "registerControlUiDescriptor"
      | "registerRuntimeLifecycle"
      | "registerAgentEventSubscription"
      | "emitAgentEvent"
      | "setRunContext"
      | "getRunContext"
      | "clearRunContext"
      | "registerSessionSchedulerJob"
      | "registerSessionAction"
      | "sendSessionAttachment"
      | "scheduleSessionTurn"
      | "unscheduleSessionTurnsByTag"
      | "registerDetachedTaskRuntime"
      | "registerMemoryCapability"
      | "registerMemoryPromptSection"
      | "registerMemoryPromptSupplement"
      | "registerMemoryCorpusSupplement"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "on"
    >
  >;
};

const noopRegisterTool: QuietCorePluginApi["registerTool"] = () => {};
const noopRegisterHook: QuietCorePluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: QuietCorePluginApi["registerHttpRoute"] = () => {};
const noopRegisterHostedMediaResolver: QuietCorePluginApi["registerHostedMediaResolver"] = () => {};
const noopRegisterChannel: QuietCorePluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: QuietCorePluginApi["registerGatewayMethod"] = () => {};
const noopRegisterCli: QuietCorePluginApi["registerCli"] = () => {};
const noopRegisterReload: QuietCorePluginApi["registerReload"] = () => {};
const noopRegisterNodeHostCommand: QuietCorePluginApi["registerNodeHostCommand"] = () => {};
const noopRegisterNodeInvokePolicy: QuietCorePluginApi["registerNodeInvokePolicy"] = () => {};
const noopRegisterSecurityAuditCollector: QuietCorePluginApi["registerSecurityAuditCollector"] =
  () => {};
const noopRegisterService: QuietCorePluginApi["registerService"] = () => {};
const noopRegisterGatewayDiscoveryService: QuietCorePluginApi["registerGatewayDiscoveryService"] =
  () => {};
const noopRegisterCliBackend: QuietCorePluginApi["registerCliBackend"] = () => {};
const noopRegisterTextTransforms: QuietCorePluginApi["registerTextTransforms"] = () => {};
const noopRegisterConfigMigration: QuietCorePluginApi["registerConfigMigration"] = () => {};
const noopRegisterMigrationProvider: QuietCorePluginApi["registerMigrationProvider"] = () => {};
const noopRegisterAutoEnableProbe: QuietCorePluginApi["registerAutoEnableProbe"] = () => {};
const noopRegisterProvider: QuietCorePluginApi["registerProvider"] = () => {};
const noopRegisterModelCatalogProvider: QuietCorePluginApi["registerModelCatalogProvider"] =
  () => {};
const noopRegisterEmbeddingProvider: QuietCorePluginApi["registerEmbeddingProvider"] = () => {};
const noopRegisterSpeechProvider: QuietCorePluginApi["registerSpeechProvider"] = () => {};
const noopRegisterRealtimeTranscriptionProvider: QuietCorePluginApi["registerRealtimeTranscriptionProvider"] =
  () => {};
const noopRegisterRealtimeVoiceProvider: QuietCorePluginApi["registerRealtimeVoiceProvider"] =
  () => {};
const noopRegisterMediaUnderstandingProvider: QuietCorePluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterTranscriptsSourceProvider: QuietCorePluginApi["registerTranscriptSourceProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: QuietCorePluginApi["registerImageGenerationProvider"] =
  () => {};
const noopRegisterVideoGenerationProvider: QuietCorePluginApi["registerVideoGenerationProvider"] =
  () => {};
const noopRegisterMusicGenerationProvider: QuietCorePluginApi["registerMusicGenerationProvider"] =
  () => {};
const noopRegisterWebFetchProvider: QuietCorePluginApi["registerWebFetchProvider"] = () => {};
const noopRegisterWebSearchProvider: QuietCorePluginApi["registerWebSearchProvider"] = () => {};
const noopRegisterInteractiveHandler: QuietCorePluginApi["registerInteractiveHandler"] = () => {};
const noopOnConversationBindingResolved: QuietCorePluginApi["onConversationBindingResolved"] =
  () => {};
const noopRegisterCommand: QuietCorePluginApi["registerCommand"] = () => {};
const noopRegisterContextEngine: QuietCorePluginApi["registerContextEngine"] = () => {};
const noopRegisterCompactionProvider: QuietCorePluginApi["registerCompactionProvider"] = () => {};
const noopRegisterAgentHarness: QuietCorePluginApi["registerAgentHarness"] = () => {};
const noopRegisterCodexAppServerExtensionFactory: QuietCorePluginApi["registerCodexAppServerExtensionFactory"] =
  () => {};
const noopRegisterAgentToolResultMiddleware: QuietCorePluginApi["registerAgentToolResultMiddleware"] =
  () => {};
const noopRegisterSessionExtension: QuietCorePluginApi["registerSessionExtension"] = () => {};
const noopEnqueueNextTurnInjection: QuietCorePluginApi["enqueueNextTurnInjection"] = async (
  injection,
) => ({ enqueued: false, id: "", sessionKey: injection.sessionKey });
const noopRegisterTrustedToolPolicy: QuietCorePluginApi["registerTrustedToolPolicy"] = () => {};
const noopRegisterToolMetadata: QuietCorePluginApi["registerToolMetadata"] = () => {};
const noopRegisterControlUiDescriptor: QuietCorePluginApi["registerControlUiDescriptor"] = () => {};
const noopRegisterRuntimeLifecycle: QuietCorePluginApi["registerRuntimeLifecycle"] = () => {};
const noopRegisterAgentEventSubscription: QuietCorePluginApi["registerAgentEventSubscription"] =
  () => {};
const noopEmitAgentEvent: QuietCorePluginApi["emitAgentEvent"] = () => ({
  emitted: false,
  reason: "not wired",
});
const noopSetRunContext: QuietCorePluginApi["setRunContext"] = () => false;
const noopGetRunContext: QuietCorePluginApi["getRunContext"] = () => undefined;
const noopClearRunContext: QuietCorePluginApi["clearRunContext"] = () => {};
const noopRegisterSessionSchedulerJob: QuietCorePluginApi["registerSessionSchedulerJob"] = () =>
  undefined;
const noopRegisterSessionAction: QuietCorePluginApi["registerSessionAction"] = () => {};
const noopSendSessionAttachment: QuietCorePluginApi["sendSessionAttachment"] = async () => ({
  ok: false,
  error: "not wired",
});
const noopScheduleSessionTurn: QuietCorePluginApi["scheduleSessionTurn"] = async () => undefined;
const noopUnscheduleSessionTurnsByTag: QuietCorePluginApi["unscheduleSessionTurnsByTag"] =
  async () => ({ removed: 0, failed: 0 });
const noopRegisterDetachedTaskRuntime: QuietCorePluginApi["registerDetachedTaskRuntime"] = () => {};
const noopRegisterMemoryCapability: QuietCorePluginApi["registerMemoryCapability"] = () => {};
const noopRegisterMemoryPromptSection: QuietCorePluginApi["registerMemoryPromptSection"] = () => {};
const noopRegisterMemoryPromptSupplement: QuietCorePluginApi["registerMemoryPromptSupplement"] =
  () => {};
const noopRegisterMemoryCorpusSupplement: QuietCorePluginApi["registerMemoryCorpusSupplement"] =
  () => {};
const noopRegisterMemoryFlushPlan: QuietCorePluginApi["registerMemoryFlushPlan"] = () => {};
const noopRegisterMemoryRuntime: QuietCorePluginApi["registerMemoryRuntime"] = () => {};
const noopRegisterMemoryEmbeddingProvider: QuietCorePluginApi["registerMemoryEmbeddingProvider"] =
  () => {};
const noopOn: QuietCorePluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): QuietCorePluginApi {
  const handlers = params.handlers ?? {};
  const registerCli = handlers.registerCli ?? noopRegisterCli;
  const api: QuietCorePluginApiWithoutFacades = {
    id: params.id,
    name: params.name,
    version: params.version,
    description: params.description,
    source: params.source,
    rootDir: params.rootDir,
    registrationMode: params.registrationMode,
    config: params.config,
    pluginConfig: params.pluginConfig,
    runtime: params.runtime,
    logger: params.logger,
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerHostedMediaResolver:
      handlers.registerHostedMediaResolver ?? noopRegisterHostedMediaResolver,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerCli,
    registerNodeCliFeature: (registrar, opts) =>
      registerCli(registrar, {
        ...opts,
        parentPath: ["nodes"],
      }),
    registerReload: handlers.registerReload ?? noopRegisterReload,
    registerNodeHostCommand: handlers.registerNodeHostCommand ?? noopRegisterNodeHostCommand,
    registerNodeInvokePolicy: handlers.registerNodeInvokePolicy ?? noopRegisterNodeInvokePolicy,
    registerSecurityAuditCollector:
      handlers.registerSecurityAuditCollector ?? noopRegisterSecurityAuditCollector,
    registerService: handlers.registerService ?? noopRegisterService,
    registerGatewayDiscoveryService:
      handlers.registerGatewayDiscoveryService ?? noopRegisterGatewayDiscoveryService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerTextTransforms: handlers.registerTextTransforms ?? noopRegisterTextTransforms,
    registerConfigMigration: handlers.registerConfigMigration ?? noopRegisterConfigMigration,
    registerMigrationProvider: handlers.registerMigrationProvider ?? noopRegisterMigrationProvider,
    registerAutoEnableProbe: handlers.registerAutoEnableProbe ?? noopRegisterAutoEnableProbe,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerModelCatalogProvider:
      handlers.registerModelCatalogProvider ?? noopRegisterModelCatalogProvider,
    registerEmbeddingProvider: handlers.registerEmbeddingProvider ?? noopRegisterEmbeddingProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerRealtimeTranscriptionProvider:
      handlers.registerRealtimeTranscriptionProvider ?? noopRegisterRealtimeTranscriptionProvider,
    registerRealtimeVoiceProvider:
      handlers.registerRealtimeVoiceProvider ?? noopRegisterRealtimeVoiceProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerTranscriptSourceProvider:
      handlers.registerTranscriptSourceProvider ?? noopRegisterTranscriptsSourceProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
    registerVideoGenerationProvider:
      handlers.registerVideoGenerationProvider ?? noopRegisterVideoGenerationProvider,
    registerMusicGenerationProvider:
      handlers.registerMusicGenerationProvider ?? noopRegisterMusicGenerationProvider,
    registerWebFetchProvider: handlers.registerWebFetchProvider ?? noopRegisterWebFetchProvider,
    registerWebSearchProvider: handlers.registerWebSearchProvider ?? noopRegisterWebSearchProvider,
    registerInteractiveHandler:
      handlers.registerInteractiveHandler ?? noopRegisterInteractiveHandler,
    onConversationBindingResolved:
      handlers.onConversationBindingResolved ?? noopOnConversationBindingResolved,
    registerCommand: handlers.registerCommand ?? noopRegisterCommand,
    registerContextEngine: handlers.registerContextEngine ?? noopRegisterContextEngine,
    registerCompactionProvider:
      handlers.registerCompactionProvider ?? noopRegisterCompactionProvider,
    registerAgentHarness: handlers.registerAgentHarness ?? noopRegisterAgentHarness,
    registerCodexAppServerExtensionFactory:
      handlers.registerCodexAppServerExtensionFactory ?? noopRegisterCodexAppServerExtensionFactory,
    registerAgentToolResultMiddleware:
      handlers.registerAgentToolResultMiddleware ?? noopRegisterAgentToolResultMiddleware,
    registerSessionExtension: handlers.registerSessionExtension ?? noopRegisterSessionExtension,
    enqueueNextTurnInjection: handlers.enqueueNextTurnInjection ?? noopEnqueueNextTurnInjection,
    registerTrustedToolPolicy: handlers.registerTrustedToolPolicy ?? noopRegisterTrustedToolPolicy,
    registerToolMetadata: handlers.registerToolMetadata ?? noopRegisterToolMetadata,
    registerControlUiDescriptor:
      handlers.registerControlUiDescriptor ?? noopRegisterControlUiDescriptor,
    registerRuntimeLifecycle: handlers.registerRuntimeLifecycle ?? noopRegisterRuntimeLifecycle,
    registerAgentEventSubscription:
      handlers.registerAgentEventSubscription ?? noopRegisterAgentEventSubscription,
    emitAgentEvent: handlers.emitAgentEvent ?? noopEmitAgentEvent,
    setRunContext: handlers.setRunContext ?? noopSetRunContext,
    getRunContext: handlers.getRunContext ?? noopGetRunContext,
    clearRunContext: handlers.clearRunContext ?? noopClearRunContext,
    registerSessionSchedulerJob:
      handlers.registerSessionSchedulerJob ?? noopRegisterSessionSchedulerJob,
    registerSessionAction: handlers.registerSessionAction ?? noopRegisterSessionAction,
    sendSessionAttachment: handlers.sendSessionAttachment ?? noopSendSessionAttachment,
    scheduleSessionTurn: handlers.scheduleSessionTurn ?? noopScheduleSessionTurn,
    unscheduleSessionTurnsByTag:
      handlers.unscheduleSessionTurnsByTag ?? noopUnscheduleSessionTurnsByTag,
    registerDetachedTaskRuntime:
      handlers.registerDetachedTaskRuntime ?? noopRegisterDetachedTaskRuntime,
    registerMemoryCapability: handlers.registerMemoryCapability ?? noopRegisterMemoryCapability,
    registerMemoryPromptSection:
      handlers.registerMemoryPromptSection ?? noopRegisterMemoryPromptSection,
    registerMemoryPromptSupplement:
      handlers.registerMemoryPromptSupplement ?? noopRegisterMemoryPromptSupplement,
    registerMemoryCorpusSupplement:
      handlers.registerMemoryCorpusSupplement ?? noopRegisterMemoryCorpusSupplement,
    registerMemoryFlushPlan: handlers.registerMemoryFlushPlan ?? noopRegisterMemoryFlushPlan,
    registerMemoryRuntime: handlers.registerMemoryRuntime ?? noopRegisterMemoryRuntime,
    registerMemoryEmbeddingProvider:
      handlers.registerMemoryEmbeddingProvider ?? noopRegisterMemoryEmbeddingProvider,
    resolvePath: params.resolvePath,
    on: handlers.on ?? noopOn,
  };
  return attachPluginApiFacades(api);
}
