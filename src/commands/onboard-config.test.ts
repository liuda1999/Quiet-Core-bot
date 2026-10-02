// Onboard config tests cover workspace, bootstrap, and local setup config mutations.
import { describe, expect, it } from "vitest";
import type { QuietCoreConfig } from "../config/config.js";
import {
  applyLocalSetupWorkspaceConfig,
  applyMemorySearchDefaultsConfig,
} from "./onboard-config.js";

describe("applyLocalSetupWorkspaceConfig", () => {
  it("sets secure dmScope default when unset", () => {
    const baseConfig: QuietCoreConfig = {};
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("per-channel-peer");
    expect(result.gateway?.mode).toBe("local");
    expect(result.agents?.defaults?.workspace).toBe("/tmp/workspace");
    expect(result.tools?.profile).toBe("coding");
  });

  it("preserves existing dmScope when already configured", () => {
    const baseConfig: QuietCoreConfig = {
      session: {
        dmScope: "main",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("main");
  });

  it("preserves explicit non-main dmScope values", () => {
    const baseConfig: QuietCoreConfig = {
      session: {
        dmScope: "per-account-channel-peer",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("per-account-channel-peer");
  });

  it("preserves an explicit tools.profile when already configured", () => {
    const baseConfig: QuietCoreConfig = {
      tools: {
        profile: "full",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.tools?.profile).toBe("full");
  });

  it("preserves agents.list and bindings on onboard rerun (quiet-core-bot#84692)", () => {
    const baseConfig: QuietCoreConfig = {
      agents: {
        list: [
          { id: "alpha", model: "anthropic/claude-3-5-sonnet" },
          { id: "beta", model: "openai/gpt-4o" },
        ],
      },
      bindings: [
        {
          type: "route",
          agentId: "alpha",
          match: { channel: "discord", peer: { kind: "direct", id: "user-1" } },
        },
      ],
    } as QuietCoreConfig;

    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.agents?.list).toHaveLength(2);
    expect(result.agents?.list?.map((a) => a.id)).toEqual(["alpha", "beta"]);
    expect(result.bindings).toEqual(baseConfig.bindings);
  });
});

describe("applyMemorySearchDefaultsConfig", () => {
  it("pins memory search to FTS-only when the auth backend cannot embed", () => {
    const result = applyMemorySearchDefaultsConfig({}, "custom-api-key");

    expect(result.agents?.defaults?.memorySearch?.provider).toBe("none");
  });

  it("leaves memory search unset when the auth backend serves embeddings", () => {
    const result = applyMemorySearchDefaultsConfig({}, "ollama");

    expect(result.agents?.defaults?.memorySearch?.provider).toBeUndefined();
  });
});
