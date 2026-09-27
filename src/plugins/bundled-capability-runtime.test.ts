// Verifies bundled capability runtime registration from plugin metadata.
import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["quiet-core-bot/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@quiet-core/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["quiet-core-bot/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@quiet-core/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["quiet-core-bot/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@quiet-core/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["quiet-core-bot/plugin-sdk/speech-core"]).toBe(
      aliasMap["@quiet-core/plugin-sdk/speech-core"],
    );
  });
});
