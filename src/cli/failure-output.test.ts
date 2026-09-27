// Failure output tests cover CLI error formatting and failure summaries.
import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "quiet-core-bot", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[quiet-core-bot] Could not start the CLI.",
      "[quiet-core-bot] Reason: config file is invalid",
      "[quiet-core-bot] Debug: set QUIET_CORE_DEBUG=1 to include the stack trace.",
      "[quiet-core-bot] Try: quiet-core-bot doctor",
      "[quiet-core-bot] Help: quiet-core-bot --help",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { QUIET_CORE_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[quiet-core-bot] The CLI command failed.",
      "[quiet-core-bot] Reason: boom",
      "[quiet-core-bot] Stack:",
      "[quiet-core-bot] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
