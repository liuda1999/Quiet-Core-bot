/**
 * Tests agent directory compatibility helpers.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOpenClawAgentDir } from "./agent-dir-compat.js";

describe("resolveOpenClawAgentDir", () => {
  it("keeps the shipped Pi env alias for deprecated plugin SDK callers", () => {
    expect(
      resolveOpenClawAgentDir({
        PI_CODING_AGENT_DIR: "/tmp/quiet-core-bot-legacy-agent",
      }),
    ).toBe(path.resolve("/tmp/quiet-core-bot-legacy-agent"));
  });

  it("prefers the Quiet Core bot env override over the deprecated Pi alias", () => {
    expect(
      resolveOpenClawAgentDir({
        QUIET_CORE_AGENT_DIR: "/tmp/quiet-core-bot-agent",
        PI_CODING_AGENT_DIR: "/tmp/quiet-core-bot-legacy-agent",
      }),
    ).toBe(path.resolve("/tmp/quiet-core-bot-agent"));
  });
});
