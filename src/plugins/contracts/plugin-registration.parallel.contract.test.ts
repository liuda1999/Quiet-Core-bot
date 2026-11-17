import { pluginRegistrationContractCases } from "quiet-core-bot/plugin-sdk/plugin-test-contracts";
import { describePluginRegistrationContract } from "quiet-core-bot/plugin-sdk/plugin-test-contracts";
import { describe, it } from "vitest";
import { isBundledExtensionPresent } from "./test-helpers/bundled-extension-presence.js";

const parallelContractCase = pluginRegistrationContractCases.parallel;

if (isBundledExtensionPresent(parallelContractCase.pluginId)) {
  describePluginRegistrationContract(parallelContractCase);
} else {
  describe("parallel plugin registration contract", () => {
    it.skip(`covers ${parallelContractCase.pluginId} when the bundled extension ships`, () => {});
  });
}
