// Matrix API module exposes the plugin public contract.
import type { QuietCorePluginApi } from "quiet-core-bot/plugin-sdk/channel-entry-contract";

type MatrixSubagentHooksModule = typeof import("./src/matrix/subagent-hooks.js");

let matrixSubagentHooksPromise: Promise<MatrixSubagentHooksModule> | null = null;

function loadMatrixSubagentHooksModule() {
  matrixSubagentHooksPromise ??= import("./src/matrix/subagent-hooks.js");
  return matrixSubagentHooksPromise;
}

export function registerMatrixSubagentHooks(api: QuietCorePluginApi): void {
  api.on("subagent_ended", async (event) => {
    const { handleMatrixSubagentEnded } = await loadMatrixSubagentHooksModule();
    await handleMatrixSubagentEnded(event);
  });
  api.on("subagent_delivery_target", async (event) => {
    const { handleMatrixSubagentDeliveryTarget } = await loadMatrixSubagentHooksModule();
    return handleMatrixSubagentDeliveryTarget(event);
  });
}
