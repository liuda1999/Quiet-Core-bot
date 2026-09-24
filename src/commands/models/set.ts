/** Command for setting the default text model. */
import { logConfigUpdated } from "../../config/logging.js";
import { resolveAgentModelPrimaryValue } from "../../config/model-input.js";
import type { RuntimeEnv } from "../../runtime.js";
import { applyDefaultModelPrimaryUpdate, updateConfig } from "./shared.js";

/** Sets agents.defaults.model.primary. */
export async function modelsSetCommand(modelRaw: string, runtime: RuntimeEnv) {
  const updated = await updateConfig((cfg, context) => {
    return applyDefaultModelPrimaryUpdate({
      cfg,
      resolveCfg: context.runtimeConfig,
      modelRaw,
      field: "model",
    });
  });
  const selectedModel = resolveAgentModelPrimaryValue(updated.agents?.defaults?.model) ?? modelRaw;

  logConfigUpdated(runtime);
  runtime.log(`Default model: ${selectedModel}`);
}
