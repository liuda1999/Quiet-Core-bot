// Matrix plugin module implements monitor route test support behavior.
export {
  registerSessionBindingAdapter,
  testing,
} from "quiet-core-bot/plugin-sdk/session-binding-runtime";
export { resolveAgentRoute } from "quiet-core-bot/plugin-sdk/routing";
export {
  createTestRegistry,
  setActivePluginRegistry,
} from "quiet-core-bot/plugin-sdk/plugin-test-runtime";
export type { QuietCoreConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
