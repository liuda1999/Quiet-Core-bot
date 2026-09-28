// Proxy stream wrapper tests cover wrapper selection and provider passthrough.
import type { StreamFn } from "quiet-core-bot/plugin-sdk/agent-core";
import type { Context, Model } from "quiet-core-bot/plugin-sdk/llm";
import { createAssistantMessageEventStream } from "quiet-core-bot/plugin-sdk/llm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOpenRouterSystemCacheWrapper, createOpenRouterWrapper } from "./proxy.js";

function runSystemCacheWrapper(model: Partial<Model<"openai-completions">>) {
  const payload = {
    messages: [{ role: "system", content: "system prompt" }],
  };
  const baseStreamFn: StreamFn = (resolvedModel, context, options) => {
    options?.onPayload?.(payload, resolvedModel);
    return createAssistantMessageEventStream();
  };

  const wrapped = createOpenRouterSystemCacheWrapper(baseStreamFn);
  void wrapped(
    {
      api: "openai-completions",
      provider: "openrouter",
      id: "anthropic/claude-sonnet-4.6",
      ...model,
    } as Model<"openai-completions">,
    { messages: [] },
    {},
  );

  return payload;
}

const ATTRIBUTION_ENV_KEY = "QUIET_CORE_PROVIDER_ATTRIBUTION";

// Attribution headers are opt-in. These tests cover the opted-in payloads; the default-off
// contract has its own block below.
beforeEach(() => {
  process.env[ATTRIBUTION_ENV_KEY] = "1";
});

afterEach(() => {
  delete process.env[ATTRIBUTION_ENV_KEY];
});

describe("proxy stream wrappers without attribution opt-in", () => {
  beforeEach(() => {
    delete process.env[ATTRIBUTION_ENV_KEY];
  });

  it("omits attribution headers by default", () => {
    const calls: Array<{ headers?: Record<string, string> }> = [];
    const baseStreamFn: StreamFn = (model, context, options) => {
      calls.push({ headers: options?.headers });
      return createAssistantMessageEventStream();
    };

    const wrapped = createOpenRouterWrapper(baseStreamFn);
    const model = {
      api: "openai-completions",
      provider: "openrouter",
      id: "openrouter/auto",
    } as Model<"openai-completions">;

    void wrapped(model, { messages: [] }, { headers: { "X-Custom": "1" } });

    expect(calls).toEqual([{ headers: { "X-Custom": "1" } }]);
  });
});

describe("proxy stream wrappers", () => {
  it("adds OpenRouter attribution headers to stream options", () => {
    const calls: Array<{ headers?: Record<string, string> }> = [];
    const baseStreamFn: StreamFn = (model, context, options) => {
      calls.push({
        headers: options?.headers,
      });
      return createAssistantMessageEventStream();
    };

    const wrapped = createOpenRouterWrapper(baseStreamFn);
    const model = {
      api: "openai-completions",
      provider: "openrouter",
      id: "openrouter/auto",
    } as Model<"openai-completions">;
    const context: Context = { messages: [] };

    void wrapped(model, context, { headers: { "X-Custom": "1" } });

    expect(calls).toEqual([
      {
        headers: {
          "HTTP-Referer": "https://github.com/liuda1999/Quiet-Core-bot",
          "X-OpenRouter-Title": "Quiet Core bot",
          "X-OpenRouter-Categories":
            "cli-agent,cloud-agent,programming-app,creative-writing,writing-assistant,general-chat,personal-agent",
          "X-Custom": "1",
        },
      },
    ]);
  });

  it("withholds OpenRouter response caching headers without a provider manifest", () => {
    const calls: Array<{ headers?: Record<string, string> }> = [];
    const baseStreamFn: StreamFn = (model, context, options) => {
      calls.push({ headers: options?.headers });
      return createAssistantMessageEventStream();
    };

    const wrapped = createOpenRouterWrapper(baseStreamFn, undefined, {
      responseCache: true,
      responseCacheTtlSeconds: 900,
    });

    void wrapped(
      {
        api: "openai-completions",
        provider: "openrouter",
        id: "openrouter/auto",
        baseUrl: "https://openrouter.ai/api/v1",
      } as Model<"openai-completions">,
      { messages: [] },
      {},
    );

    // OpenRouter-specific headers require a manifest-declared OpenRouter endpoint;
    // without one the host is classified as `custom` and nothing is attached.
    const headers = calls[0]?.headers ?? {};
    expect(headers).not.toHaveProperty("HTTP-Referer");
    expect(headers).not.toHaveProperty("X-OpenRouter-Cache");
    expect(headers).not.toHaveProperty("X-OpenRouter-Cache-TTL");
  });

  it("sends OpenRouter response cache disables for preset opt-outs", () => {
    const calls: Array<{ headers?: Record<string, string> }> = [];
    const baseStreamFn: StreamFn = (model, context, options) => {
      calls.push({ headers: options?.headers });
      return createAssistantMessageEventStream();
    };

    const wrapped = createOpenRouterWrapper(baseStreamFn, undefined, {
      response_cache: false,
      response_cache_ttl_seconds: 600,
    });

    void wrapped(
      {
        api: "openai-completions",
        provider: "openrouter",
        id: "openrouter/@preset/cached-tests",
      } as Model<"openai-completions">,
      { messages: [] },
      {},
    );

    expect(calls[0]?.headers?.["X-OpenRouter-Cache"]).toBe("false");
    expect(calls[0]?.headers).not.toHaveProperty("X-OpenRouter-Cache-TTL");
  });

  it("supports OpenRouter response cache refresh and TTL clamping", () => {
    const calls: Array<{ headers?: Record<string, string> }> = [];
    const baseStreamFn: StreamFn = (model, context, options) => {
      calls.push({ headers: options?.headers });
      return createAssistantMessageEventStream();
    };

    const wrapped = createOpenRouterWrapper(baseStreamFn, undefined, {
      response_cache_clear: "true",
      response_cache_ttl: 999999,
    });

    void wrapped(
      {
        api: "openai-completions",
        provider: "openrouter",
        id: "openrouter/auto",
      } as Model<"openai-completions">,
      { messages: [] },
      {},
    );

    expect(calls[0]?.headers?.["X-OpenRouter-Cache"]).toBe("true");
    expect(calls[0]?.headers?.["X-OpenRouter-Cache-Clear"]).toBe("true");
    expect(calls[0]?.headers?.["X-OpenRouter-Cache-TTL"]).toBe("86400");
  });

  it("does not add OpenRouter response caching headers to custom proxy routes", () => {
    const calls: Array<{ headers?: Record<string, string> }> = [];
    const baseStreamFn: StreamFn = (model, context, options) => {
      calls.push({ headers: options?.headers });
      return createAssistantMessageEventStream();
    };

    const wrapped = createOpenRouterWrapper(baseStreamFn, undefined, {
      responseCache: true,
    });

    void wrapped(
      {
        api: "openai-completions",
        provider: "openrouter",
        id: "openrouter/auto",
        baseUrl: "https://proxy.example.com/v1",
      } as Model<"openai-completions">,
      { messages: [] },
      {},
    );

    expect(calls[0]?.headers).toBeUndefined();
  });

  it("injects cache_control markers for declared OpenRouter Anthropic models on the default route", () => {
    const payload = runSystemCacheWrapper({});

    expect(payload.messages[0]?.content).toEqual([
      { type: "text", text: "system prompt", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("does not inject cache_control markers for declared OpenRouter providers on custom proxy URLs", () => {
    const payload = runSystemCacheWrapper({
      baseUrl: "https://proxy.example.com/v1",
    });

    expect(payload.messages[0]?.content).toBe("system prompt");
  });

  it("does not inject Anthropic cache_control markers for automatic OpenRouter DeepSeek cache models", () => {
    const payload = runSystemCacheWrapper({
      id: "deepseek/deepseek-v3.2",
    });

    expect(payload.messages[0]?.content).toBe("system prompt");
  });

  it("leaves system content untouched for OpenRouter hosts without a provider manifest", () => {
    const payload = runSystemCacheWrapper({
      provider: "custom-openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
    });

    // Native-host detection also depends on manifest-declared endpoints, so a host
    // without one keeps the plain string content and no cache markers.
    expect(payload.messages[0]?.content).toBe("system prompt");
  });

  it("does not forward OpenRouter Anthropic cacheRetention to the underlying OpenAI transport", () => {
    const payload = {
      messages: [{ role: "system", content: "system prompt" }],
    };
    const calls: Array<{ cacheRetention?: unknown }> = [];
    const baseStreamFn: StreamFn = (resolvedModel, _context, options) => {
      calls.push({ cacheRetention: options?.cacheRetention });
      options?.onPayload?.(payload, resolvedModel);
      return createAssistantMessageEventStream();
    };

    const wrapped = createOpenRouterSystemCacheWrapper(baseStreamFn);
    void wrapped(
      {
        api: "openai-completions",
        provider: "openrouter",
        id: "anthropic/claude-sonnet-4.6",
      } as Model<"openai-completions">,
      { messages: [] },
      { cacheRetention: "long" },
    );

    expect(calls[0]).toEqual({ cacheRetention: undefined });
    expect(payload.messages[0]?.content).toEqual([
      {
        type: "text",
        text: "system prompt",
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    ]);
  });
});
