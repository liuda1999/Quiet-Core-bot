// Covers provider auth choice selection for plugin-owned providers.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWizardPrompter } from "../../test/helpers/wizard-prompter.js";
import { createNonExitingRuntime } from "../runtime.js";
import type { ProviderPlugin } from "./types.js";

const { testing, applyAuthChoicePluginProvider } = await import("./provider-auth-choice.js");

function buildProvider(): ProviderPlugin {
  return {
    id: "openai",
    label: "OpenAI",
    auth: [
      {
        id: "api-key",
        label: "API key",
        kind: "api_key",
        run: vi.fn(async () => ({
          profiles: [],
          notes: [],
          defaultModel: "gpt-5.5",
        })),
      },
    ],
  };
}

describe("applyAuthChoicePluginProvider", () => {
  beforeEach(() => {
    testing.resetDepsForTest();
  });

  it("applies the provider-selected default model", async () => {
    const provider = buildProvider();
    const runProviderModelSelectedHook = vi.fn(async () => undefined);
    testing.setDepsForTest({
      loadPluginProviderRuntime: async () =>
        ({
          resolvePluginProviders: () => [provider],
          runProviderModelSelectedHook,
        }) as never,
    });

    const result = await applyAuthChoicePluginProvider(
      {
        authChoice: "openai-api-key",
        config: {},
        runtime: createNonExitingRuntime(),
        prompter: createWizardPrompter(),
        setDefaultModel: true,
      },
      {
        authChoice: "openai-api-key",
        pluginId: "openai",
        providerId: "openai",
        methodId: "api-key",
        label: "OpenAI",
      },
    );

    expect(runProviderModelSelectedHook).toHaveBeenCalledOnce();
    expect(result?.config?.agents?.defaults?.model).toEqual({ primary: "gpt-5.5" });
  });
});
