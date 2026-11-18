// Covers provider context-window probing: payload parsing, caching, model switches.
import { afterEach, describe, expect, it } from "vitest";
import {
  clearContextWindowProbeCache,
  parseContextWindowFromModelsPayload,
  probeModelContextWindow,
  withProbedContextWindow,
} from "./model-context-window-probe.js";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Swaps the global fetch without the mocking helper so this stays a fast test. */
function stubFetch(handler: (url: string) => Promise<Response>): { calls: string[] } {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return await handler(url);
  }) as typeof fetch;
  return { calls };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearContextWindowProbeCache();
});

describe("parseContextWindowFromModelsPayload", () => {
  it("reads context_length for the requested model", () => {
    const payload = {
      data: [
        { id: "small-model", context_length: 32_768 },
        { id: "big-model", context_length: 1_048_576 },
      ],
    };

    expect(parseContextWindowFromModelsPayload(payload, "big-model")).toBe(1_048_576);
  });

  it("accepts provider-prefixed ids and top_provider metadata", () => {
    const payload = {
      data: [
        {
          id: "vendor/model-x",
          top_provider: { context_length: 262_144 },
        },
      ],
    };

    expect(parseContextWindowFromModelsPayload(payload, "model-x")).toBe(262_144);
  });

  it("supports alternative field names used by local servers", () => {
    expect(
      parseContextWindowFromModelsPayload({ models: [{ id: "m", max_model_len: 65_536 }] }, "m"),
    ).toBe(65_536);
    expect(parseContextWindowFromModelsPayload([{ id: "m", context_window: 131_072 }], "m")).toBe(
      131_072,
    );
  });

  it("falls back to the only entry when the provider hides ids", () => {
    expect(
      parseContextWindowFromModelsPayload({ data: [{ context_length: 200_000 }] }, "any"),
    ).toBe(200_000);
  });

  it("ignores missing, non-numeric, and absurd values", () => {
    expect(parseContextWindowFromModelsPayload({ data: [{ id: "m" }] }, "m")).toBeUndefined();
    expect(
      parseContextWindowFromModelsPayload({ data: [{ id: "m", context_length: "128k" }] }, "m"),
    ).toBeUndefined();
    expect(
      parseContextWindowFromModelsPayload({ data: [{ id: "m", context_length: -1 }] }, "m"),
    ).toBeUndefined();
    expect(
      parseContextWindowFromModelsPayload({ data: [{ id: "m", context_length: 99_999_999 }] }, "m"),
    ).toBeUndefined();
  });
});

describe("probeModelContextWindow", () => {
  it("caches a successful lookup per model", async () => {
    const { calls } = stubFetch(async () =>
      jsonResponse({ data: [{ id: "m1", context_length: 400_000 }] }),
    );

    const first = await probeModelContextWindow({
      provider: "custom",
      modelId: "m1",
      baseUrl: "https://api.example.com/v1",
    });
    const second = await probeModelContextWindow({
      provider: "custom",
      modelId: "m1",
      baseUrl: "https://api.example.com/v1",
    });

    expect(first).toBe(400_000);
    expect(second).toBe(400_000);
    expect(calls).toHaveLength(1);
  });

  it("returns different windows after a model switch", async () => {
    stubFetch(async () =>
      jsonResponse({
        data: [
          { id: "model-a", context_length: 200_000 },
          { id: "model-b", context_length: 1_000_000 },
        ],
      }),
    );

    const a = await probeModelContextWindow({
      provider: "custom",
      modelId: "model-a",
      baseUrl: "https://api.example.com/v1",
    });
    const b = await probeModelContextWindow({
      provider: "custom",
      modelId: "model-b",
      baseUrl: "https://api.example.com/v1",
    });

    expect(a).toBe(200_000);
    expect(b).toBe(1_000_000);
  });

  it("tries the unversioned path when the versioned one 404s", async () => {
    const { calls } = stubFetch(async (url) =>
      url.endsWith("/v1/models")
        ? jsonResponse({ error: "not found" }, 404)
        : jsonResponse({ data: [{ id: "m", context_length: 128_000 }] }),
    );

    const tokens = await probeModelContextWindow({
      provider: "custom",
      modelId: "m",
      baseUrl: "https://api.example.com",
    });

    expect(tokens).toBe(128_000);
    expect(calls).toEqual(["https://api.example.com/v1/models", "https://api.example.com/models"]);
  });

  it("returns undefined and negatively caches when the provider fails", async () => {
    const { calls } = stubFetch(async () => {
      throw new Error("network down");
    });

    expect(
      await probeModelContextWindow({
        provider: "p",
        modelId: "m",
        baseUrl: "https://api.example.com",
      }),
    ).toBeUndefined();
    expect(
      await probeModelContextWindow({
        provider: "p",
        modelId: "m",
        baseUrl: "https://api.example.com",
      }),
    ).toBeUndefined();
    expect(calls).toHaveLength(2); // 两个候选 URL 各试一次，第二次请求走负缓存
  });
});

describe("withProbedContextWindow", () => {
  it("marks the probed model so config no longer wins", () => {
    const model = { id: "m", contextWindow: 128_000 };
    const next = withProbedContextWindow(model, 1_000_000);

    expect(next).toMatchObject({ contextWindow: 1_000_000, contextWindowProbed: true });
    expect(model.contextWindow).toBe(128_000); // 不修改共享对象
  });

  it("returns the original model when the probe found nothing", () => {
    const model = { id: "m", contextWindow: 128_000 };
    expect(withProbedContextWindow(model, undefined)).toBe(model);
  });
});
