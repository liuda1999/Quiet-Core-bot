// Session binding registry contract tests cover channel session binding across registry fixtures.
import { isBundledExtensionPresent } from "../../../plugins/contracts/test-helpers/bundled-extension-presence.js";
import { getSessionBindingContractRegistry } from "./test-helpers/registry-session-binding.js";
import { describeSessionBindingRegistryBackedContract } from "./test-helpers/session-binding-registry-backed-contract.js";

for (const entry of getSessionBindingContractRegistry()) {
  if (!isBundledExtensionPresent(entry.id)) {
    continue;
  }
  describeSessionBindingRegistryBackedContract(entry.id);
}
