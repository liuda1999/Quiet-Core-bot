// Comfy tests cover index plugin behavior.
import fs from "node:fs";
import { registerSingleProviderPlugin } from "openclaw/plugin-sdk/plugin-test-runtime";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

type ComfyManifest = {
  providerAuthChoices?: Array<{ choiceId?: string; method?: string; provider?: string }>;
};

function readManifest(): ComfyManifest {
  return JSON.parse(
    fs.readFileSync(new URL("./openclaw.plugin.json", import.meta.url), "utf8"),
  ) as ComfyManifest;
}

describe("comfy provider plugin", () => {
  it("registers the local ComfyUI provider", async () => {
    const provider = await registerSingleProviderPlugin(plugin);

    expect(provider.id).toBe("comfy");
    expect(provider.envVars).toEqual(["COMFY_API_KEY", "COMFY_CLOUD_API_KEY"]);
    expect(provider.auth).toEqual([]);
    expect(readManifest().providerAuthChoices).toBeUndefined();
  });
});
