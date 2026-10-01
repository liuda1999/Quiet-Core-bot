/**
 * Runtime store for host-provided QuietCore services used by the ClickClack
 * bundled plugin.
 */
import { createPluginRuntimeStore } from "quiet-core-bot/plugin-sdk/runtime-store";
import type { PluginRuntime } from "quiet-core-bot/plugin-sdk/runtime-store";

const { setRuntime: setClickClackRuntime, getRuntime: getClickClackRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "clickclack",
    errorMessage: "ClickClack runtime not initialized",
  });

export { getClickClackRuntime, setClickClackRuntime };
