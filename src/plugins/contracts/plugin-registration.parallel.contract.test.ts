import { pluginRegistrationContractCases } from "quiet-core-bot/plugin-sdk/plugin-test-contracts";
import { describePluginRegistrationContract } from "quiet-core-bot/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract(pluginRegistrationContractCases.parallel);
