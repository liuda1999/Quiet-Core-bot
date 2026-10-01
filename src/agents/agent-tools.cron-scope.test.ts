/**
 * Tests cron-triggered tool assembly.
 * Ensures cron runs scope cron tool behavior to self-removal of the current
 * job only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const mocks = vi.hoisted(() => {
  const stubTool = (name: string) =>
    ({
      name,
      label: name,
      displaySummary: name,
      description: name,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    }) satisfies AnyAgentTool;

  return {
    createQuietCoreToolsOptions: vi.fn(),
    stubTool,
  };
});

vi.mock("./quiet-core-bot-tools.js", () => ({
  createQuietCoreTools: (options: unknown) => {
    mocks.createQuietCoreToolsOptions(options);
    return [mocks.stubTool("cron")];
  },
}));

import "./test-helpers/fast-bash-tools.js";
import "./test-helpers/fast-coding-tools.js";
import { createQuietCoreCodingTools } from "./agent-tools.js";

function firstQuietCoreToolsOptions(): { cronSelfRemoveOnlyJobId?: string } | undefined {
  return mocks.createQuietCoreToolsOptions.mock.calls[0]?.[0] as
    | { cronSelfRemoveOnlyJobId?: string }
    | undefined;
}

describe("createQuietCoreCodingTools cron scope", () => {
  beforeEach(() => {
    mocks.createQuietCoreToolsOptions.mockClear();
  });

  it("scopes cron-triggered jobs to self-removal", () => {
    const tools = createQuietCoreCodingTools({
      trigger: "cron",
      jobId: "job-current",
    });

    expect(tools.map((tool) => tool.name)).toContain("cron");
    expect(firstQuietCoreToolsOptions()?.cronSelfRemoveOnlyJobId).toBe("job-current");
  });

  it("does not scope non-cron sessions", () => {
    createQuietCoreCodingTools({
      trigger: "user",
      jobId: "job-current",
    });

    expect(firstQuietCoreToolsOptions()?.cronSelfRemoveOnlyJobId).toBeUndefined();
  });
});
