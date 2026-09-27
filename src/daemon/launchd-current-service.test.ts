// Launchd current service tests cover resolving active macOS service labels.
import { describe, expect, it } from "vitest";
import { isCurrentProcessLaunchdServiceLabel } from "./launchd-current-service.js";

describe("isCurrentProcessLaunchdServiceLabel", () => {
  it("matches launchd-provided service labels", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.quiet-core-bot.gateway", {
        LAUNCH_JOB_LABEL: "ai.quiet-core-bot.gateway",
      }),
    ).toBe(true);
  });

  it("falls back to Quiet Core bot service markers when XPC_SERVICE_NAME is inherited", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.quiet-core-bot.gateway", {
        XPC_SERVICE_NAME: "0",
        QUIET_CORE_SERVICE_MARKER: "quiet-core-bot",
        QUIET_CORE_SERVICE_KIND: "gateway",
        QUIET_CORE_LAUNCHD_LABEL: "ai.quiet-core-bot.gateway",
      }),
    ).toBe(true);
  });

  it("preserves label-only fallback when launchd exposes no label variables", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.quiet-core-bot.gateway", {
        QUIET_CORE_LAUNCHD_LABEL: "ai.quiet-core-bot.gateway",
      }),
    ).toBe(true);
  });

  it("can require service markers for label-only fallback", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel(
        "ai.quiet-core-bot.gateway",
        {
          QUIET_CORE_LAUNCHD_LABEL: "ai.quiet-core-bot.gateway",
        },
        { allowConfiguredLabelFallback: false },
      ),
    ).toBe(false);
  });

  it("does not treat unrelated inherited launchd labels as current services", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.quiet-core-bot.gateway", {
        XPC_SERVICE_NAME: "0",
        QUIET_CORE_LAUNCHD_LABEL: "ai.quiet-core-bot.gateway",
      }),
    ).toBe(false);
  });
});
