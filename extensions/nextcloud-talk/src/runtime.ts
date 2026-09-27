// Nextcloud Talk plugin module implements runtime behavior.
import { createPluginRuntimeStore } from "quiet-core-bot/plugin-sdk/runtime-store";
import type { PluginRuntime } from "quiet-core-bot/plugin-sdk/runtime-store";

const { setRuntime: setNextcloudTalkRuntime, getRuntime: getNextcloudTalkRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "nextcloud-talk",
    errorMessage: "Nextcloud Talk runtime not initialized",
  });
export { getNextcloudTalkRuntime, setNextcloudTalkRuntime };
