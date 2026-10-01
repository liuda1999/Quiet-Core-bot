// Verifies Quiet Core bot plugin tools are resolved with browser/runtime context.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuietCoreConfig } from "../config/config.js";
import { resetConfigRuntimeState, setRuntimeConfigSnapshot } from "../config/config.js";
import { activateSecretsRuntimeSnapshot, clearSecretsRuntimeSnapshot } from "../secrets/runtime.js";
import { resolveQuietCorePluginToolsForOptions } from "./quiet-core-bot-plugin-tools.js";

const hoisted = vi.hoisted(() => ({
  resolvePluginTools: vi.fn(),
}));

vi.mock("../plugins/tools.js", () => ({
  resolvePluginTools: (...args: unknown[]) => hoisted.resolvePluginTools(...args),
}));

function firstResolvePluginToolsParams(): Record<string, unknown> {
  // Captures the plugin runtime contract passed from Quiet Core bot tool resolution.
  const call = hoisted.resolvePluginTools.mock.calls[0];
  if (!call) {
    throw new Error("Expected plugin tool resolution");
  }
  return call[0] as Record<string, unknown>;
}

describe("createQuietCoreTools browser plugin integration", () => {
  afterEach(() => {
    hoisted.resolvePluginTools.mockReset();
    clearSecretsRuntimeSnapshot();
    resetConfigRuntimeState();
  });

  it("keeps the browser tool returned by plugin resolution", () => {
    hoisted.resolvePluginTools.mockReturnValue([
      {
        name: "browser",
        description: "browser fixture tool",
        parameters: {
          type: "object",
          properties: {},
        },
        async execute() {
          return {
            content: [{ type: "text", text: "ok" }],
          };
        },
      },
    ]);

    const config = {
      plugins: {
        allow: ["browser"],
      },
    } as QuietCoreConfig;

    const tools = resolveQuietCorePluginToolsForOptions({
      options: { config },
      resolvedConfig: config,
    });

    expect(tools.map((tool) => tool.name)).toContain("browser");
  });

  it("omits the browser tool when plugin resolution returns no browser tool", () => {
    hoisted.resolvePluginTools.mockReturnValue([]);

    const config = {
      plugins: {
        allow: ["browser"],
        entries: {
          browser: {
            enabled: false,
          },
        },
      },
    } as QuietCoreConfig;

    const tools = resolveQuietCorePluginToolsForOptions({
      options: { config },
      resolvedConfig: config,
    });

    expect(tools.map((tool) => tool.name)).not.toContain("browser");
  });

  it("forwards fsPolicy into plugin tool context", async () => {
    let capturedContext: { fsPolicy?: { workspaceOnly: boolean } } | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      const resolvedParams = params as { context?: { fsPolicy?: { workspaceOnly: boolean } } };
      capturedContext = resolvedParams.context;
      return [
        {
          name: "browser",
          description: "browser fixture tool",
          parameters: {
            type: "object",
            properties: {},
          },
          async execute() {
            return {
              content: [{ type: "text", text: "ok" }],
              details: { workspaceOnly: capturedContext?.fsPolicy?.workspaceOnly ?? null },
            };
          },
        },
      ];
    });

    const tools = resolveQuietCorePluginToolsForOptions({
      options: {
        config: {
          plugins: {
            allow: ["browser"],
          },
        } as QuietCoreConfig,
        fsPolicy: { workspaceOnly: true },
      },
      resolvedConfig: {
        plugins: {
          allow: ["browser"],
        },
      } as QuietCoreConfig,
    });

    const browserTool = tools.find((tool) => tool.name === "browser");
    if (browserTool === undefined) {
      throw new Error("expected browser tool");
    }

    const result = await browserTool.execute("tool-call", {});
    const details = (result.details ?? {}) as { workspaceOnly?: boolean | null };
    expect(details.workspaceOnly).toBe(true);
  });

  it("forwards gateway subagent binding to plugin resolution", () => {
    hoisted.resolvePluginTools.mockReturnValue([]);
    const config = {
      plugins: {
        allow: ["browser"],
      },
    } as QuietCoreConfig;

    resolveQuietCorePluginToolsForOptions({
      options: { config, allowGatewaySubagentBinding: true },
      resolvedConfig: config,
    });

    expect(hoisted.resolvePluginTools).toHaveBeenCalledTimes(1);
    expect(firstResolvePluginToolsParams().allowGatewaySubagentBinding).toBe(true);
  });

  it("forwards auth profile helpers to plugin resolution and context", async () => {
    let capturedParams:
      | {
          hasAuthForProvider?: (providerId: string) => boolean;
          context?: {
            hasAuthForProvider?: (providerId: string) => boolean;
            resolveApiKeyForProvider?: (providerId: string) => Promise<string | undefined>;
          };
        }
      | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      capturedParams = params as typeof capturedParams;
      return [];
    });
    const config = {
      auth: {
        order: {
          xai: ["xai-profile"],
        },
      },
      plugins: {
        allow: ["xai"],
      },
    } as QuietCoreConfig;

    resolveQuietCorePluginToolsForOptions({
      options: {
        config,
        authProfileStore: {
          version: 1,
          profiles: {
            "xai-excluded": {
              type: "api_key",
              provider: "xai",
              key: "xai-excluded-key", // pragma: allowlist secret
            },
            "xai-profile": {
              type: "api_key",
              provider: "xai",
              key: "xai-profile-key", // pragma: allowlist secret
            },
          },
        },
      },
      resolvedConfig: config,
    });

    expect(capturedParams?.hasAuthForProvider?.("xai")).toBe(true);
    expect(capturedParams?.context?.hasAuthForProvider?.("xai")).toBe(true);
    await expect(capturedParams?.context?.resolveApiKeyForProvider?.("xai")).resolves.toBe(
      "xai-profile-key",
    );
  });

  it("forwards plugin tool deny policy to plugin resolution", () => {
    hoisted.resolvePluginTools.mockReturnValue([]);
    const config = {
      plugins: {
        allow: ["browser"],
      },
    } as QuietCoreConfig;

    resolveQuietCorePluginToolsForOptions({
      options: {
        config,
        pluginToolAllowlist: ["*"],
        pluginToolDenylist: ["browser"],
      },
      resolvedConfig: config,
    });

    expect(hoisted.resolvePluginTools).toHaveBeenCalledTimes(1);
    const params = firstResolvePluginToolsParams();
    expect(params.toolAllowlist).toEqual(["*"]);
    expect(params.toolDenylist).toEqual(["browser"]);
  });

  it("does not pass a stale active snapshot as plugin runtime config for a resolved run config", () => {
    // Resolved run config must win over any process-global runtime snapshot.
    const staleSourceConfig = {
      plugins: {
        allow: ["old-plugin"],
      },
    } as QuietCoreConfig;
    const staleRuntimeConfig = {
      plugins: {
        allow: ["old-plugin"],
      },
    } as QuietCoreConfig;
    const resolvedRunConfig = {
      plugins: {
        allow: ["browser"],
      },
      tools: {
        experimental: {
          planTool: true,
        },
      },
    } as QuietCoreConfig;
    let capturedRuntimeConfig: QuietCoreConfig | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      capturedRuntimeConfig = (params as { context?: { runtimeConfig?: QuietCoreConfig } }).context
        ?.runtimeConfig;
      return [];
    });
    activateSecretsRuntimeSnapshot({
      sourceConfig: staleSourceConfig,
      config: staleRuntimeConfig,
      authStores: [],
      warnings: [],
      webTools: {
        search: {
          providerSource: "none",
          diagnostics: [],
        },
        fetch: {
          providerSource: "none",
          diagnostics: [],
        },
        diagnostics: [],
      },
    });

    resolveQuietCorePluginToolsForOptions({
      options: { config: resolvedRunConfig },
      resolvedConfig: resolvedRunConfig,
    });

    expect(capturedRuntimeConfig).toBe(resolvedRunConfig);
  });

  it("does not let a source-less pinned config snapshot override explicit plugin tool config", () => {
    const pinnedRuntimeConfig = {
      plugins: {
        allow: ["old-plugin"],
      },
    } as QuietCoreConfig;
    const explicitConfig = {
      plugins: {
        allow: ["browser"],
      },
      tools: {
        experimental: {
          planTool: true,
        },
      },
    } as QuietCoreConfig;
    let capturedRuntimeConfig: QuietCoreConfig | undefined;
    let getRuntimeConfig: (() => QuietCoreConfig | undefined) | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      const context = (
        params as {
          context?: {
            runtimeConfig?: QuietCoreConfig;
            getRuntimeConfig?: () => QuietCoreConfig | undefined;
          };
        }
      ).context;
      capturedRuntimeConfig = context?.runtimeConfig;
      getRuntimeConfig = context?.getRuntimeConfig;
      return [];
    });
    setRuntimeConfigSnapshot(pinnedRuntimeConfig);

    resolveQuietCorePluginToolsForOptions({
      options: { config: explicitConfig },
      resolvedConfig: explicitConfig,
    });

    expect(capturedRuntimeConfig).toBe(explicitConfig);
    expect(getRuntimeConfig?.()).toBe(explicitConfig);
  });

  it("exposes a live runtime config getter to plugin tool factories", () => {
    const sourceConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    } as QuietCoreConfig;
    const firstRuntimeConfig = {
      plugins: {
        allow: ["memory-core"],
        entries: { "memory-core": { enabled: true } },
      },
    } as QuietCoreConfig;
    const nextRuntimeConfig = {
      plugins: {
        allow: ["memory-core"],
        entries: { "memory-core": { enabled: false } },
      },
    } as QuietCoreConfig;
    let getRuntimeConfig: (() => QuietCoreConfig | undefined) | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      getRuntimeConfig = (
        params as { context?: { getRuntimeConfig?: () => QuietCoreConfig | undefined } }
      ).context?.getRuntimeConfig;
      return [];
    });
    setRuntimeConfigSnapshot(firstRuntimeConfig, sourceConfig);

    resolveQuietCorePluginToolsForOptions({
      options: { config: sourceConfig },
      resolvedConfig: sourceConfig,
    });

    expect(getRuntimeConfig?.()).toStrictEqual(firstRuntimeConfig);

    setRuntimeConfigSnapshot(nextRuntimeConfig, sourceConfig);

    expect(getRuntimeConfig?.()).toStrictEqual(nextRuntimeConfig);
    expect(getRuntimeConfig?.()?.plugins?.entries?.["memory-core"]?.enabled).toBe(false);
  });
});
