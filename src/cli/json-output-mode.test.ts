// JSON output mode tests cover CLI JSON mode detection and output handling.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loggingState } from "../logging/state.js";
import {
  hasJsonOutputFlag,
  enableDiagnosticsToStderr,
  withConsoleLogsRoutedToStderrForJson,
} from "./json-output-mode.js";

describe("json output mode", () => {
  const originalForceStderr = loggingState.forceConsoleToStderr;
  const originalDiagnosticsStderr = loggingState.forceDiagnosticsToStderr;

  beforeEach(() => {
    loggingState.forceConsoleToStderr = false;
    loggingState.forceDiagnosticsToStderr = false;
  });

  afterEach(() => {
    loggingState.forceConsoleToStderr = originalForceStderr;
    loggingState.forceDiagnosticsToStderr = originalDiagnosticsStderr;
  });

  it("detects json output flags before argv terminators", () => {
    expect(hasJsonOutputFlag(["node", "quiet-core-bot", "nodes", "list", "--json"])).toBe(true);
    expect(hasJsonOutputFlag(["node", "quiet-core-bot", "nodes", "list", "--json=true"])).toBe(true);
    expect(hasJsonOutputFlag(["node", "quiet-core-bot", "nodes", "--", "--json"])).toBe(false);
  });

  it("temporarily routes console logs to stderr while json output is being prepared", async () => {
    const snapshots: boolean[] = [];

    await withConsoleLogsRoutedToStderrForJson(
      ["node", "quiet-core-bot", "nodes", "list", "--json"],
      async () => {
        snapshots.push(loggingState.forceConsoleToStderr);
      },
    );

    expect(snapshots).toEqual([true]);
    expect(loggingState.forceConsoleToStderr).toBe(false);
  });

  it("leaves existing stderr routing enabled after json output preparation", async () => {
    loggingState.forceConsoleToStderr = true;

    await withConsoleLogsRoutedToStderrForJson(
      ["node", "quiet-core-bot", "nodes", "list", "--json"],
      async () => {
        expect(loggingState.forceConsoleToStderr).toBe(true);
      },
    );

    expect(loggingState.forceConsoleToStderr).toBe(true);
  });

  it("routes diagnostics to stderr and restores the previous switch", () => {
    const restore = enableDiagnosticsToStderr();
    expect(loggingState.forceDiagnosticsToStderr).toBe(true);
    // Explicit `console.log`/`runtime.log` payloads must not be redirected by this switch.
    expect(loggingState.forceConsoleToStderr).toBe(false);

    restore();
    expect(loggingState.forceDiagnosticsToStderr).toBe(false);
  });

  it("keeps diagnostics routed to stderr when a prior switch was already enabled", () => {
    loggingState.forceDiagnosticsToStderr = true;
    const restore = enableDiagnosticsToStderr();
    restore();
    expect(loggingState.forceDiagnosticsToStderr).toBe(true);
  });
});
