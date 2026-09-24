// Verifies the core built-in canonical endpoint fallbacks.
//
// `endpointClass` is normally supplied by provider plugin manifests
// (`providerEndpoints`). Builds that ship without the bundled `openai` provider plugin
// therefore have no manifest declaring `api.openai.com`, so a small built-in fallback
// keeps the canonical OpenAI family on the native route.
//
// This file intentionally does not mock the plugin registry, so the built-in fallback
// is exercised instead of manifest-declared metadata.
import { describe, expect, it } from "vitest";
import { resolveOpenAIStrictToolSetting } from "./openai-strict-tool-setting.js";
import {
  resolveProviderEndpoint,
  resolveProviderRequestCapabilities,
  resolveProviderRequestPolicy,
} from "./provider-attribution.js";

describe("built-in canonical provider endpoints", () => {
  it("classifies canonical OpenAI public hosts without a provider manifest", () => {
    expect(resolveProviderEndpoint("https://api.openai.com/v1")).toMatchObject({
      endpointClass: "openai-public",
      hostname: "api.openai.com",
    });
    expect(resolveProviderEndpoint("https://api.openai.com")).toMatchObject({
      endpointClass: "openai-public",
      hostname: "api.openai.com",
    });
    expect(resolveProviderEndpoint("https://eu.api.openai.com/v1")).toMatchObject({
      endpointClass: "openai-public",
      hostname: "eu.api.openai.com",
    });
  });

  it("classifies the ChatGPT and Azure OpenAI hosts without a provider manifest", () => {
    expect(resolveProviderEndpoint("https://chatgpt.com/backend-api")).toMatchObject({
      endpointClass: "openai",
      hostname: "chatgpt.com",
    });
    expect(resolveProviderEndpoint("https://tenant.openai.azure.com/openai/v1")).toMatchObject({
      endpointClass: "azure-openai",
      hostname: "tenant.openai.azure.com",
    });
  });

  it("keeps non-canonical hosts custom and missing base URLs default", () => {
    expect(resolveProviderEndpoint("https://example.com/v1")).toMatchObject({
      endpointClass: "custom",
      hostname: "example.com",
    });
    expect(resolveProviderEndpoint(undefined)).toEqual({ endpointClass: "default" });
    expect(resolveProviderEndpoint("   ")).toEqual({ endpointClass: "default" });
  });

  it("routes canonical OpenAI base URLs through the native OpenAI route", () => {
    const input = {
      provider: "openai",
      api: "openai-responses",
      baseUrl: "https://api.openai.com/v1",
      capability: "llm" as const,
      transport: "stream" as const,
      modelId: "gpt-5.5",
    };
    expect(resolveProviderRequestCapabilities(input)).toMatchObject({
      endpointClass: "openai-public",
      usesKnownNativeOpenAIEndpoint: true,
      usesKnownNativeOpenAIRoute: true,
    });
    expect(resolveProviderRequestPolicy(input)).toMatchObject({
      endpointClass: "openai-public",
      usesConfiguredBaseUrl: true,
      usesExplicitProxyLikeEndpoint: false,
    });
  });

  it("keeps a custom OpenAI-compatible base URL on the proxy route", () => {
    const input = {
      provider: "openai",
      api: "openai-responses",
      baseUrl: "https://example.com/v1",
      capability: "llm" as const,
      transport: "stream" as const,
      modelId: "gpt-5.5",
    };
    expect(resolveProviderRequestCapabilities(input)).toMatchObject({
      endpointClass: "custom",
      usesKnownNativeOpenAIEndpoint: false,
      usesKnownNativeOpenAIRoute: false,
    });
    expect(resolveProviderRequestPolicy(input)).toMatchObject({
      usesExplicitProxyLikeEndpoint: true,
    });
  });

  it("injects strict Responses tool schemas for canonical and default base URLs", () => {
    expect(
      resolveOpenAIStrictToolSetting({
        provider: "openai",
        api: "openai-responses",
        baseUrl: "https://api.openai.com/v1",
        id: "gpt-5.5",
      }),
    ).toBe(true);
    expect(
      resolveOpenAIStrictToolSetting({
        provider: "openai",
        api: "openai-responses",
        id: "gpt-5.5",
      }),
    ).toBe(true);
    expect(
      resolveOpenAIStrictToolSetting({
        provider: "azure-openai",
        api: "azure-openai-responses",
        baseUrl: "https://tenant.openai.azure.com/openai/v1",
        id: "gpt-5.5",
      }),
    ).toBe(true);
    expect(
      resolveOpenAIStrictToolSetting({
        provider: "custom-openai",
        api: "openai-responses",
        baseUrl: "https://example.com/v1",
        id: "custom-model",
      }),
    ).toBeUndefined();
  });
});
