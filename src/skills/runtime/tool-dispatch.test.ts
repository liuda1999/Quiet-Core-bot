// Skill tool dispatch tests cover policy-filtered tool surfaces.
import { describe, expect, it, vi } from "vitest";
import type { QuietCoreConfig } from "../../config/types.quiet-core-bot.js";

type CreateQuietCoreToolsArg = {
  cronCreatorToolAllowlist?: Array<string | { name: string; pluginId?: string }>;
};

const hoisted = vi.hoisted(() => {
  function makeTool(name: string) {
    return {
      name,
      description: `${name} tool`,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    };
  }
  return {
    createQuietCoreToolsMock: vi.fn((_args: CreateQuietCoreToolsArg) => [
      makeTool("read"),
      makeTool("cron"),
      makeTool("exec"),
    ]),
  };
});

vi.mock("../../agents/quiet-core-bot-tools.runtime.js", () => ({
  createQuietCoreTools: (args: CreateQuietCoreToolsArg) => hoisted.createQuietCoreToolsMock(args),
}));

import { resolveSkillDispatchTools } from "./tool-dispatch.js";

describe("resolveSkillDispatchTools", () => {
  it("passes final filtered tool surface to cron jobs", () => {
    const tools = resolveSkillDispatchTools({
      message: { surface: "telegram", senderId: "user-1" },
      cfg: {
        tools: { allow: ["read", "cron"] },
      } as QuietCoreConfig,
      agentId: "main",
      sessionKey: "agent:main:telegram:group:restricted-room",
      workspaceDir: "/tmp/quiet-core-bot-skill-tool-dispatch-test",
      provider: "openai",
      model: "gpt-5.5",
    });

    const args = hoisted.createQuietCoreToolsMock.mock.calls[0]?.[0];
    expect(tools.map((tool) => tool.name)).toEqual(["read", "cron"]);
    expect(args?.cronCreatorToolAllowlist).toEqual([{ name: "read" }, { name: "cron" }]);
  });
});
