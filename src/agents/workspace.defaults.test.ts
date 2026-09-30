// Workspace default tests cover environment-variable precedence for the
// built-in agent workspace location.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withEnv } from "../test-utils/env.js";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses QUIET_CORE_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "quiet-core-bot-home");

    const resolved = withEnv(
      {
        QUIET_CORE_WORKSPACE_DIR: undefined,
        QUIET_CORE_PROFILE: undefined,
        // The test harness pins QUIET_CORE_STATE_DIR on Windows; clear it so
        // QUIET_CORE_HOME drives the resolved workspace.
        QUIET_CORE_STATE_DIR: undefined,
        QUIET_CORE_HOME: home,
        HOME: path.join(path.sep, "home", "other"),
      },
      () => resolveDefaultAgentWorkspaceDir(),
    );

    expect(resolved).toBe(path.join(path.resolve(home), ".quiet-core-bot", "workspace"));
  });

  it("uses QUIET_CORE_WORKSPACE_DIR before QUIET_CORE_HOME", () => {
    const workspaceDir = path.join(path.sep, "srv", "quiet-core-bot-workspace");

    const resolved = withEnv(
      {
        QUIET_CORE_WORKSPACE_DIR: workspaceDir,
        QUIET_CORE_HOME: path.join(path.sep, "srv", "quiet-core-bot-home"),
      },
      () => resolveDefaultAgentWorkspaceDir(),
    );

    expect(resolved).toBe(path.resolve(workspaceDir));
  });
});
