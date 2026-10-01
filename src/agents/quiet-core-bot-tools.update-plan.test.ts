// Verifies update_plan registration gates and base Quiet Core bot tool inclusion policy.
import { afterEach, describe, expect, it } from "vitest";
import type { QuietCoreConfig } from "../config/config.js";
import { setEmbeddedMode } from "../infra/embedded-mode.js";
import { isToolWrappedWithBeforeToolCallHook } from "./agent-tools.before-tool-call.js";
import { createQuietCoreTools } from "./quiet-core-bot-tools.js";
import { shouldIncludeUpdatePlanToolForQuietCoreTools } from "./quiet-core-bot-tools.registration.js";
import { createUpdatePlanTool } from "./tools/update-plan-tool.js";

type UpdatePlanGatingParams = Parameters<typeof shouldIncludeUpdatePlanToolForQuietCoreTools>[0];
type CreateQuietCoreToolsOptions = NonNullable<Parameters<typeof createQuietCoreTools>[0]>;

function expectUpdatePlanEnabled(params: UpdatePlanGatingParams, expected: boolean): void {
  expect(shouldIncludeUpdatePlanToolForQuietCoreTools(params)).toBe(expected);
}

function toolNames(tools: ReturnType<typeof createQuietCoreTools>): string[] {
  return tools.map((tool) => tool.name);
}

function createFastToolNames(options: CreateQuietCoreToolsOptions): string[] {
  // Disable unrelated dynamic surfaces so registration assertions stay deterministic.
  return toolNames(
    createQuietCoreTools({
      disableMessageTool: true,
      disablePluginTools: true,
      wrapBeforeToolCallHook: false,
      ...options,
    }),
  );
}

function expectToolNamed(
  tools: ReturnType<typeof createQuietCoreTools>,
  name: string,
): ReturnType<typeof createQuietCoreTools>[number] {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Expected tool ${name} to be registered`);
  }
  return tool;
}

function openAiGpt5Params(
  config: QuietCoreConfig,
  overrides: Partial<UpdatePlanGatingParams> = {},
): UpdatePlanGatingParams {
  // Common OpenAI GPT-5 selection used by model-aware update_plan gates.
  const params: UpdatePlanGatingParams = {
    config,
    agentSessionKey: "agent:main:main",
    modelProvider: "openai",
    modelId: "gpt-5.4",
    ...overrides,
  };
  if ("agentId" in overrides && !("agentSessionKey" in overrides)) {
    delete params.agentSessionKey;
  }
  return params;
}

describe("quiet-core-bot-tools update_plan gating", () => {
  afterEach(() => {
    setEmbeddedMode(false);
  });

  it("keeps update_plan disabled by default", () => {
    expectUpdatePlanEnabled({ config: {} as QuietCoreConfig }, false);
  });

  it("does not expose update_plan from default tool construction", () => {
    const defaultTools = createFastToolNames({
      config: {} as QuietCoreConfig,
      modelProvider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
    const emptyAllowlistParams = {
      config: {} as QuietCoreConfig,
      pluginToolAllowlist: [],
      modelProvider: "anthropic",
      modelId: "claude-sonnet-4-6",
    };

    expect(defaultTools).not.toContain("update_plan");
    expect(shouldIncludeUpdatePlanToolForQuietCoreTools(emptyAllowlistParams)).toBe(false);
  });

  it("wraps constructed tools with before-tool-call hooks by default", () => {
    const tools = createQuietCoreTools({
      config: {} as QuietCoreConfig,
      disablePluginTools: true,
    });
    const unwrappedTools = createQuietCoreTools({
      config: {} as QuietCoreConfig,
      disablePluginTools: true,
      wrapBeforeToolCallHook: false,
    });

    expect(isToolWrappedWithBeforeToolCallHook(expectToolNamed(tools, "sessions_list"))).toBe(true);
    expect(
      isToolWrappedWithBeforeToolCallHook(expectToolNamed(unwrappedTools, "sessions_list")),
    ).toBe(false);
  });

  it("keeps message tool in embedded message-tool-only completions", () => {
    setEmbeddedMode(true);
    const tools = createQuietCoreTools({
      config: {} as QuietCoreConfig,
      disablePluginTools: true,
      wrapBeforeToolCallHook: false,
      sourceReplyDeliveryMode: "message_tool_only",
    });

    expect(toolNames(tools)).toContain("message");
  });

  it("requires explicit transcripts enablement before registering the transcripts tool", () => {
    const defaultTools = createFastToolNames({
      config: {} as QuietCoreConfig,
    });
    const enabledTools = createFastToolNames({
      config: { transcripts: { enabled: true } } as QuietCoreConfig,
    });

    expect(defaultTools).not.toContain("transcripts");
    expect(enabledTools).toContain("transcripts");
  });

  it("keeps explicitly allowed message tool in embedded completions", () => {
    setEmbeddedMode(true);
    const fromRuntimeAllowlist = createQuietCoreTools({
      config: {} as QuietCoreConfig,
      disablePluginTools: true,
      pluginToolAllowlist: ["message"],
      wrapBeforeToolCallHook: false,
    });
    const fromGlobalAlsoAllow = createQuietCoreTools({
      config: { tools: { profile: "minimal", alsoAllow: ["message"] } } as QuietCoreConfig,
      disablePluginTools: true,
      wrapBeforeToolCallHook: false,
    });
    const denied = createQuietCoreTools({
      config: {} as QuietCoreConfig,
      disablePluginTools: true,
      pluginToolAllowlist: ["message"],
      pluginToolDenylist: ["message"],
      wrapBeforeToolCallHook: false,
    });

    expect(toolNames(fromRuntimeAllowlist)).toContain("message");
    expect(toolNames(fromGlobalAlsoAllow)).toContain("message");
    expect(toolNames(denied)).not.toContain("message");
  });

  it("keeps subagent spawn available for trusted embedded gateway-bound runs", () => {
    setEmbeddedMode(true);
    const defaultTools = createFastToolNames({
      config: {} as QuietCoreConfig,
    });
    const gatewayBoundTools = createFastToolNames({
      config: {} as QuietCoreConfig,
      allowGatewaySubagentBinding: true,
    });

    expect(defaultTools).not.toContain("sessions_spawn");
    expect(defaultTools).not.toContain("sessions_send");
    expect(gatewayBoundTools).toContain("sessions_spawn");
    expect(gatewayBoundTools).not.toContain("sessions_send");
  });

  it("registers update_plan when explicitly enabled", () => {
    const config = {
      tools: {
        experimental: {
          planTool: true,
        },
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled({ config }, true);
    expect(createUpdatePlanTool().displaySummary).toBe("Track short work plan.");
  });

  it("registers update_plan when the runtime allowlist explicitly requests it", () => {
    const tools = createFastToolNames({
      config: {} as QuietCoreConfig,
      pluginToolAllowlist: ["update_plan"],
      modelProvider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });

    expect(tools).toContain("update_plan");
  });

  it("includes update_plan when a config allowlist group includes it", () => {
    const includeUpdatePlan = shouldIncludeUpdatePlanToolForQuietCoreTools({
      config: { tools: { allow: ["group:agents"] } } as QuietCoreConfig,
      modelProvider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });

    expect(includeUpdatePlan).toBe(true);
  });

  it("includes update_plan when a runtime allowlist group includes it", () => {
    const includeUpdatePlan = shouldIncludeUpdatePlanToolForQuietCoreTools({
      config: {} as QuietCoreConfig,
      pluginToolAllowlist: ["group:agents"],
      modelProvider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });

    expect(includeUpdatePlan).toBe(true);
  });

  it("respects deny policy for grouped allowlists", () => {
    const includeUpdatePlan = shouldIncludeUpdatePlanToolForQuietCoreTools({
      config: {} as QuietCoreConfig,
      pluginToolAllowlist: ["group:agents"],
      pluginToolDenylist: ["update_plan"],
      modelProvider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });

    expect(includeUpdatePlan).toBe(false);
  });

  it("auto-enables update_plan for unconfigured GPT-5 openai runs", () => {
    // Unspecified executionContract on a supported provider/model enables the
    // structured plan tool by default. Explicit "default" still opts out.
    const cfg = {
      agents: {
        list: [{ id: "main" }],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(openAiGpt5Params(cfg), true);
  });

  it("respects explicit default contract opt-out on GPT-5 runs", () => {
    // Users who explicitly set executionContract: "default" are saying they
    // want the old pre-parity-program behavior. Honor that opt-out.
    const cfg = {
      agents: {
        defaults: {
          embeddedAgent: {
            executionContract: "default",
          },
        },
        list: [{ id: "main" }],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(openAiGpt5Params(cfg), false);
  });

  it("does not auto-enable update_plan for non-openai providers even when unconfigured", () => {
    const cfg = {
      agents: {
        list: [{ id: "main" }],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(
      openAiGpt5Params(cfg, { modelProvider: "anthropic", modelId: "claude-sonnet-4-6" }),
      false,
    );
    expectUpdatePlanEnabled(openAiGpt5Params(cfg, { modelId: "gpt-4.1" }), false);
  });

  it("auto-enables update_plan for strict-agentic GPT-5 agents", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedAgent: {
            executionContract: "strict-agentic",
          },
        },
        list: [{ id: "main" }],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(openAiGpt5Params(cfg), true);
  });

  it("does not auto-enable update_plan for unsupported providers or models", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedAgent: {
            executionContract: "strict-agentic",
          },
        },
        list: [{ id: "main" }],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(
      openAiGpt5Params(cfg, { modelProvider: "anthropic", modelId: "claude-sonnet-4-6" }),
      false,
    );
    expectUpdatePlanEnabled(openAiGpt5Params(cfg, { modelId: "gpt-4.1" }), false);
  });

  it("lets explicit planTool false override strict-agentic auto-enable", () => {
    const cfg = {
      tools: {
        experimental: {
          planTool: false,
        },
      },
      agents: {
        defaults: {
          embeddedAgent: {
            executionContract: "strict-agentic",
          },
        },
        list: [{ id: "main" }],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(openAiGpt5Params(cfg), false);
  });

  it("resolves strict-agentic gating from explicit agentId when no session key is available", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedAgent: {
            executionContract: "default",
          },
        },
        list: [
          { id: "main" },
          {
            id: "research",
            embeddedAgent: {
              executionContract: "strict-agentic",
            },
          },
        ],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(openAiGpt5Params(cfg, { agentId: "research" }), true);
  });

  it("applies per-agent overrides without leaking the contract to other agents", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedAgent: {
            executionContract: "strict-agentic",
          },
        },
        list: [
          {
            id: "main",
            embeddedAgent: {
              executionContract: "default",
            },
          },
          {
            id: "research",
          },
        ],
      },
    } as QuietCoreConfig;

    expectUpdatePlanEnabled(openAiGpt5Params(cfg, { agentId: "main" }), false);
    expectUpdatePlanEnabled(openAiGpt5Params(cfg, { agentId: "research" }), true);
  });
});
