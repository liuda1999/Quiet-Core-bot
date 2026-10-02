// Qa Lab API module exposes the plugin public contract.
import { createLazyRuntimeMethod } from "quiet-core-bot/plugin-sdk/lazy-runtime";
import { createLazyQaChannelValue, loadQaChannelModule } from "./qa-channel-loader.js";

export type { Command } from "commander";
export type { QuietCoreConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
export { definePluginEntry } from "quiet-core-bot/plugin-sdk/plugin-entry";
export { callGatewayFromCli } from "quiet-core-bot/plugin-sdk/gateway-runtime";
export type { PluginRuntime } from "quiet-core-bot/plugin-sdk/runtime-store";
export { defaultQaRuntimeModelForMode } from "./model-selection.runtime.js";

// The qa-channel bindings are private QA capabilities: `plugin-sdk/qa-channel`
// only exists in a private QA build. They are resolved lazily so this module (and
// the rest of the qa-lab extension) still loads in default builds, and callers get
// a QaChannelUnavailableError instead of a module-resolution crash.
export const buildQaTarget = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.buildQaTarget,
);
export const createQaBusThread = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.createQaBusThread,
);
export const deleteQaBusMessage = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.deleteQaBusMessage,
);
export const editQaBusMessage = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.editQaBusMessage,
);
export const getQaBusState = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.getQaBusState,
);
export const injectQaBusInboundMessage = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.injectQaBusInboundMessage,
);
export const normalizeQaTarget = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.normalizeQaTarget,
);
export const parseQaTarget = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.parseQaTarget,
);
export const pollQaBus = createLazyRuntimeMethod(loadQaChannelModule, (module) => module.pollQaBus);
export const reactToQaBusMessage = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.reactToQaBusMessage,
);
export const readQaBusMessage = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.readQaBusMessage,
);
export const searchQaBusMessages = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.searchQaBusMessages,
);
export const sendQaBusMessage = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.sendQaBusMessage,
);
export const setQaChannelRuntime = createLazyRuntimeMethod(
  loadQaChannelModule,
  (module) => module.setQaChannelRuntime,
);
export const qaChannelPlugin = createLazyQaChannelValue((module) => module.qaChannelPlugin);

export type {
  QaBusAttachment,
  QaBusConversation,
  QaBusCreateThreadInput,
  QaBusDeleteMessageInput,
  QaBusEditMessageInput,
  QaBusEvent,
  QaBusInboundMessageInput,
  QaBusMessage,
  QaBusOutboundMessageInput,
  QaBusPollInput,
  QaBusPollResult,
  QaBusReactToMessageInput,
  QaBusReadMessageInput,
  QaBusSearchMessagesInput,
  QaBusStateSnapshot,
  QaBusThread,
  QaBusToolCall,
  QaBusWaitForInput,
} from "./protocol.js";
