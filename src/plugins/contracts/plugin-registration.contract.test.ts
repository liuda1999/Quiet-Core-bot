// Plugin registration contract tests cover manifest registration cases exposed through the SDK.
import { pluginRegistrationContractCases } from "quiet-core-bot/plugin-sdk/plugin-test-contracts";
import { describePluginRegistrationContract } from "quiet-core-bot/plugin-sdk/plugin-test-contracts";
import { filterPresentBundledExtensions } from "./test-helpers/bundled-extension-presence.js";

const presentPluginIds = new Set(
  filterPresentBundledExtensions(
    Object.values(pluginRegistrationContractCases).map((contractCase) => contractCase.pluginId),
  ),
);

const pluginRegistrationContractCaseList = Object.values(pluginRegistrationContractCases)
  .filter((contractCase) => presentPluginIds.has(contractCase.pluginId))
  .toSorted((left, right) => left.pluginId.localeCompare(right.pluginId));

for (const contractCase of pluginRegistrationContractCaseList) {
  describePluginRegistrationContract(contractCase);
}
