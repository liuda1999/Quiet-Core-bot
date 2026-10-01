// Tests Quiet Core bot execution environment construction.
import { describe, expect, it } from "vitest";
import {
  ensureQuietCoreExecMarkerOnProcess,
  markQuietCoreExecEnv,
  QUIET_CORE_CLI_ENV_VALUE,
  QUIET_CORE_CLI_ENV_VAR,
} from "./quiet-core-bot-exec-env.js";

describe("markQuietCoreExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", QUIET_CORE_CLI: "0" };
    const marked = markQuietCoreExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      QUIET_CORE_CLI: QUIET_CORE_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.QUIET_CORE_CLI).toBe("0");
  });
});

describe("ensureQuietCoreExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [QUIET_CORE_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureQuietCoreExecMarkerOnProcess(env)).toBe(env);
    expect(env[QUIET_CORE_CLI_ENV_VAR]).toBe(QUIET_CORE_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[QUIET_CORE_CLI_ENV_VAR];
    delete process.env[QUIET_CORE_CLI_ENV_VAR];

    try {
      expect(ensureQuietCoreExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[QUIET_CORE_CLI_ENV_VAR]).toBe(QUIET_CORE_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[QUIET_CORE_CLI_ENV_VAR];
      } else {
        process.env[QUIET_CORE_CLI_ENV_VAR] = previous;
      }
    }
  });
});
