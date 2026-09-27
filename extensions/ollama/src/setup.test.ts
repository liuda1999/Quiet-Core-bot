// Ollama tests cover setup plugin behavior.
import type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime-env";
import type { WizardPrompter } from "quiet-core-bot/plugin-sdk/setup";
import { jsonResponse, requestBodyText, requestUrl } from "quiet-core-bot/plugin-sdk/test-env";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetOllamaModelShowInfoCacheForTest } from "./provider-models.js";
import {
  configureOllamaNonInteractive,
  ensureOllamaModelPulled,
  promptAndConfigureOllama,
} from "./setup.js";

const upsertAuthProfileWithLock = vi.hoisted(() => vi.fn(async () => {}));
const fetchWithSsrFGuardMock = vi.hoisted(() =>
  vi.fn(async (params: { url: string; init?: RequestInit; signal?: AbortSignal }) => ({
    response: await globalThis.fetch(params.url, {
      ...params.init,
      ...(params.signal ? { signal: params.signal } : {}),
    }),
    finalUrl: params.url,
    release: async () => {},
  })),
);

vi.mock("quiet-core-bot/plugin-sdk/provider-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("quiet-core-bot/plugin-sdk/provider-auth")>();
  return {
    ...actual,
    upsertAuthProfileWithLock,
  };
});

vi.mock("quiet-core-bot/plugin-sdk/ssrf-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("quiet-core-bot/plugin-sdk/ssrf-runtime")>();
  return {
    ...actual,
    fetchWithSsrFGuard: (...args: Parameters<typeof actual.fetchWithSsrFGuard>) =>
      fetchWithSsrFGuardMock(...args),
  };
});

function createOllamaFetchMock(params: {
  tags?: string[];
  show?: Record<string, number | undefined>;
  pullResponse?: Response;
  tagsError?: Error;
}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = requestUrl(input);
    if (url.endsWith("/api/tags")) {
      if (params.tagsError) {
        throw params.tagsError;
      }
      return jsonResponse({ models: (params.tags ?? []).map((name) => ({ name })) });
    }
    if (url.endsWith("/api/show")) {
      const body = JSON.parse(requestBodyText(init?.body)) as { name?: string };
      const contextWindow = body.name ? params.show?.[body.name] : undefined;
      return contextWindow
        ? jsonResponse({ model_info: { "llama.context_length": contextWindow } })
        : jsonResponse({});
    }
    if (url.endsWith("/api/pull")) {
      return params.pullResponse ?? new Response('{"status":"success"}\n', { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function mockCall(mock: { mock: { calls: unknown[][] } }, index = 0) {
  return mock.mock.calls.at(index);
}

function mockCallArg(mock: { mock: { calls: unknown[][] } }, index = 0, argIndex = 0) {
  return mockCall(mock, index)?.at(argIndex);
}

function createLocalPrompter(): WizardPrompter {
  return {
    text: vi.fn().mockResolvedValueOnce("http://127.0.0.1:11434"),
    note: vi.fn(async () => undefined),
  } as unknown as WizardPrompter;
}

function createDefaultOllamaConfig(primary: string) {
  return {
    agents: { defaults: { model: { primary } } },
    models: { providers: { ollama: { baseUrl: "http://127.0.0.1:11434", models: [] } } },
  };
}

function createRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } as unknown as RuntimeEnv;
}

describe("ollama setup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    upsertAuthProfileWithLock.mockClear();
    fetchWithSsrFGuardMock.mockClear();
    resetOllamaModelShowInfoCacheForTest();
  });

  it("puts suggested local model first in local mode", async () => {
    const prompter = createLocalPrompter();

    const fetchMock = createOllamaFetchMock({ tags: ["llama3:8b"] });
    vi.stubGlobal("fetch", fetchMock);

    const result = await promptAndConfigureOllama({
      cfg: {},
      prompter,
    });
    const modelIds = result.config.models?.providers?.ollama?.models?.map((m) => m.id);

    expect(modelIds?.[0]).toBe("gemma4");
  });

  it("Docker setup defaults to the host Ollama endpoint", async () => {
    vi.stubEnv("QUIET_CORE_DOCKER_SETUP", "1");
    const text = vi.fn().mockResolvedValueOnce("http://host.docker.internal:11434");
    const prompter = {
      text,
      note: vi.fn(async () => undefined),
    } as unknown as WizardPrompter;

    const fetchMock = createOllamaFetchMock({ tags: ["llama3:8b"] });
    vi.stubGlobal("fetch", fetchMock);

    const result = await promptAndConfigureOllama({
      cfg: {},
      prompter,
    });

    const baseUrlPrompt = mockCallArg(text) as {
      message?: string;
      initialValue?: string;
      placeholder?: string;
      validate?: unknown;
    };
    expect(baseUrlPrompt).toEqual({
      message: "Ollama base URL",
      initialValue: "http://host.docker.internal:11434",
      placeholder: "http://host.docker.internal:11434",
      validate: baseUrlPrompt.validate,
    });
    expect(typeof baseUrlPrompt.validate).toBe("function");
    expect(mockCallArg(fetchMock)).toBe("http://host.docker.internal:11434/api/tags");
    expect(result.config.models?.providers?.ollama?.baseUrl).toBe(
      "http://host.docker.internal:11434",
    );
  });

  it("orders the suggested local model before discovered local models", async () => {
    const prompter = createLocalPrompter();

    const fetchMock = createOllamaFetchMock({ tags: ["llama3:8b", "gemma4"] });
    vi.stubGlobal("fetch", fetchMock);

    const result = await promptAndConfigureOllama({
      cfg: {},
      prompter,
    });

    const modelIds = result.config.models?.providers?.ollama?.models?.map((m) => m.id);
    expect(modelIds?.[0]).toBe("gemma4");
    expect(modelIds).toContain("llama3:8b");
  });

  it("dedupes the suggested local model against a discovered latest tag", async () => {
    const prompter = createLocalPrompter();

    const fetchMock = createOllamaFetchMock({ tags: ["gemma4:latest", "llama3:8b"] });
    vi.stubGlobal("fetch", fetchMock);

    const result = await promptAndConfigureOllama({
      cfg: {},
      prompter,
    });

    const modelIds = result.config.models?.providers?.ollama?.models?.map((m) => m.id);
    expect(modelIds).toEqual(["gemma4:latest", "llama3:8b"]);
  });

  it("local mode only hits local model discovery endpoints", async () => {
    const prompter = createLocalPrompter();

    const fetchMock = createOllamaFetchMock({ tags: ["llama3:8b"] });
    vi.stubGlobal("fetch", fetchMock);

    await promptAndConfigureOllama({
      cfg: {},
      prompter,
    });

    expect(fetchMock.mock.calls.map((call) => requestUrl(call[0]))).toEqual([
      "http://127.0.0.1:11434/api/tags",
      "http://127.0.0.1:11434/api/show",
    ]);
  });

  it("shows unreachable guidance when the host is down", async () => {
    const prompter = createLocalPrompter();
    const fetchMock = createOllamaFetchMock({ tagsError: new Error("down") });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      promptAndConfigureOllama({
        cfg: {},
        prompter,
      }),
    ).rejects.toThrow("Ollama not reachable");

    expect(prompter.note).toHaveBeenCalledWith(
      [
        "Ollama could not be reached at http://127.0.0.1:11434.",
        "Download it at https://ollama.com/download",
        "",
        "Start Ollama and re-run setup.",
      ].join("\n"),
      "Ollama",
    );
  });

  it("uses /api/show context windows when building Ollama model configs", async () => {
    const prompter = {
      text: vi.fn().mockResolvedValueOnce("http://127.0.0.1:11434"),
      note: vi.fn(async () => undefined),
    } as unknown as WizardPrompter;

    const fetchMock = createOllamaFetchMock({
      tags: ["llama3:8b"],
      show: { "llama3:8b": 65536 },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await promptAndConfigureOllama({
      cfg: {},
      prompter,
    });
    const model = result.config.models?.providers?.ollama?.models?.find(
      (m) => m.id === "llama3:8b",
    );

    expect(model?.contextWindow).toBe(65536);
  });

  describe("ensureOllamaModelPulled", () => {
    it("pulls model when not available locally", async () => {
      vi.useFakeTimers();
      try {
        const progress = { update: vi.fn(), stop: vi.fn() };
        const prompter = {
          progress: vi.fn(() => progress),
        } as unknown as WizardPrompter;

        const fetchMock = createOllamaFetchMock({
          tags: ["llama3:8b"],
          pullResponse: new Response('{"status":"success"}\n', { status: 200 }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await ensureOllamaModelPulled({
          config: createDefaultOllamaConfig("ollama/gemma4"),
          model: "ollama/gemma4",
          prompter,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(mockCallArg(fetchMock, 1)).toContain("/api/pull");
        const pullInit = mockCallArg(fetchMock, 1, 1) as RequestInit | undefined;
        expect(pullInit?.signal).toBeInstanceOf(AbortSignal);
        expect(pullInit?.signal?.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(30_000);
        expect(pullInit?.signal?.aborted).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("fails stalled model pull streams after an idle timeout", async () => {
      vi.useFakeTimers();
      try {
        const progress = { update: vi.fn(), stop: vi.fn() };
        const prompter = {
          progress: vi.fn(() => progress),
        } as unknown as WizardPrompter;
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
          const url = requestUrl(input);
          if (url.endsWith("/api/tags")) {
            return jsonResponse({ models: [] });
          }
          if (url.endsWith("/api/pull")) {
            return new Response(new ReadableStream<Uint8Array>(), { status: 200 });
          }
          throw new Error(`Unexpected fetch: ${url}`);
        });
        vi.stubGlobal("fetch", fetchMock);

        const pullPromise = ensureOllamaModelPulled({
          config: createDefaultOllamaConfig("ollama/gemma4"),
          model: "ollama/gemma4",
          prompter,
        }).catch((err: unknown) => err);

        await vi.waitFor(() => expect(mockCallArg(fetchMock, 1)).toContain("/api/pull"));

        await vi.advanceTimersByTimeAsync(300_000);
        const pullError = await pullPromise;
        expect(pullError).toBeInstanceOf(Error);
        expect((pullError as Error).name).toBe("WizardCancelledError");
        expect((pullError as Error).message).toBe("Failed to download selected Ollama model");
        expect(progress.stop).toHaveBeenCalledWith(
          "Failed to download gemma4: Ollama pull stalled: no data received for 300s",
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips pull when model is already available", async () => {
      const prompter = {} as unknown as WizardPrompter;

      const fetchMock = createOllamaFetchMock({ tags: ["gemma4"] });
      vi.stubGlobal("fetch", fetchMock);

      await ensureOllamaModelPulled({
        config: createDefaultOllamaConfig("ollama/gemma4"),
        model: "ollama/gemma4",
        prompter,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("skips pull when an untagged model is available as latest", async () => {
      const prompter = {} as unknown as WizardPrompter;

      const fetchMock = createOllamaFetchMock({ tags: ["gemma4:latest"] });
      vi.stubGlobal("fetch", fetchMock);

      await ensureOllamaModelPulled({
        config: createDefaultOllamaConfig("ollama/gemma4"),
        model: "ollama/gemma4",
        prompter,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("uses baseURL alias when checking and pulling models", async () => {
      const progress = { update: vi.fn(), stop: vi.fn() };
      const prompter = {
        progress: vi.fn(() => progress),
      } as unknown as WizardPrompter;

      const fetchMock = createOllamaFetchMock({
        tags: [],
        pullResponse: new Response('{"status":"success"}\n', { status: 200 }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await ensureOllamaModelPulled({
        config: {
          agents: { defaults: { model: { primary: "ollama/gemma4" } } },
          models: {
            providers: {
              ollama: {
                baseURL: "http://127.0.0.1:11435",
                models: [],
              } as never,
            },
          },
        },
        model: "ollama/gemma4",
        prompter,
      });

      expect(mockCallArg(fetchMock)).toBe("http://127.0.0.1:11435/api/tags");
      expect(mockCallArg(fetchMock, 1)).toBe("http://127.0.0.1:11435/api/pull");
    });

    it("skips pull for cloud models", async () => {
      const prompter = {} as unknown as WizardPrompter;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await ensureOllamaModelPulled({
        config: createDefaultOllamaConfig("ollama/kimi-k2.5:cloud"),
        model: "ollama/kimi-k2.5:cloud",
        prompter,
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("skips when model is not an ollama model", async () => {
      const prompter = {} as unknown as WizardPrompter;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await ensureOllamaModelPulled({
        config: {
          agents: { defaults: { model: { primary: "openai/gpt-4o" } } },
        },
        model: "openai/gpt-4o",
        prompter,
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("uses discovered model when requested non-interactive download fails", async () => {
    const fetchMock = createOllamaFetchMock({
      tags: ["qwen2.5-coder:7b"],
      pullResponse: new Response('{"error":"disk full"}\n', { status: 200 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const runtime = createRuntime();

    const result = await configureOllamaNonInteractive({
      nextConfig: {
        agents: {
          defaults: {
            model: {
              primary: "openai/gpt-4o-mini",
              fallbacks: ["anthropic/claude-sonnet-4-5"],
            },
          },
        },
      },
      opts: {
        customBaseUrl: "http://127.0.0.1:11434",
        customModelId: "missing-model",
      },
      runtime,
    });

    expect(runtime.error).toHaveBeenCalledWith("Download failed: disk full");
    expect(result.agents?.defaults?.model).toEqual({
      primary: "ollama/qwen2.5-coder:7b",
      fallbacks: ["anthropic/claude-sonnet-4-5"],
    });
  });

  it("normalizes ollama/ prefix in non-interactive custom model download", async () => {
    const fetchMock = createOllamaFetchMock({
      tags: [],
      pullResponse: new Response('{"status":"success"}\n', { status: 200 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const runtime = createRuntime();

    const result = await configureOllamaNonInteractive({
      nextConfig: {},
      opts: {
        customBaseUrl: "http://127.0.0.1:11434",
        customModelId: "ollama/llama3.2:latest",
      },
      runtime,
    });

    const pullRequest = mockCallArg(fetchMock, 1, 1) as RequestInit | undefined;
    expect(JSON.parse(requestBodyText(pullRequest?.body))).toEqual({ name: "llama3.2:latest" });
    expect(result.agents?.defaults?.model).toEqual({ primary: "ollama/llama3.2:latest" });
  });

  it("uses the discovered latest tag as the non-interactive default without pulling", async () => {
    const fetchMock = createOllamaFetchMock({ tags: ["gemma4:latest"] });
    vi.stubGlobal("fetch", fetchMock);
    const runtime = createRuntime();

    const result = await configureOllamaNonInteractive({
      nextConfig: {},
      opts: {
        customBaseUrl: "http://127.0.0.1:11434",
      },
      runtime,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestUrls = fetchMock.mock.calls.map((call) => requestUrl(call[0]));
    expect(requestUrls.filter((url) => url.endsWith("/api/pull"))).toEqual([]);
    expect(result.models?.providers?.ollama?.models?.map((model) => model.id)).toEqual([
      "gemma4:latest",
    ]);
    expect(result.agents?.defaults?.model).toEqual({ primary: "ollama/gemma4:latest" });
    expect(runtime.log).toHaveBeenCalledWith("Default Ollama model: gemma4:latest");
  });

  it("accepts cloud models in non-interactive mode without pulling", async () => {
    const fetchMock = createOllamaFetchMock({ tags: [] });
    vi.stubGlobal("fetch", fetchMock);
    const runtime = createRuntime();

    const result = await configureOllamaNonInteractive({
      nextConfig: {},
      opts: {
        customBaseUrl: "http://127.0.0.1:11434",
        customModelId: "kimi-k2.5:cloud",
      },
      runtime,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.models?.providers?.ollama?.models?.map((model) => model.id)).toContain(
      "kimi-k2.5:cloud",
    );
    expect(result.agents?.defaults?.model).toEqual({ primary: "ollama/kimi-k2.5:cloud" });
  });

  it("exits when Ollama is unreachable", async () => {
    const fetchMock = createOllamaFetchMock({
      tagsError: new Error("connect ECONNREFUSED"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    } as unknown as RuntimeEnv;
    const nextConfig = {};

    const result = await configureOllamaNonInteractive({
      nextConfig,
      opts: {
        customBaseUrl: "http://127.0.0.1:11435",
        customModelId: "llama3.2:latest",
      },
      runtime,
    });

    expect(runtime.error).toHaveBeenCalledWith(
      [
        "Ollama could not be reached at http://127.0.0.1:11435.",
        "Download it at https://ollama.com/download",
      ].join("\n"),
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(result).toBe(nextConfig);
  });
});
