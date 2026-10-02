// Covers broadcast dry-run reporting (no false success + channel validation)
// and session-entry suppression when a send fails channel/config preflight.
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMessageCliText } from "../../commands/message-format.js";
import type { QuietCoreConfig } from "../../config/config.js";
import { setActivePluginRegistry } from "../../plugins/runtime.js";
import { createTestRegistry } from "../../test-utils/channel-plugins.js";
import { runMessageAction } from "./message-action-runner.js";
import { workspaceConfig, workspaceTestPlugin } from "./message-action-runner.test-helpers.js";

const sendServiceMocks = vi.hoisted(() => ({
  executeSendAction: vi.fn(async (params: { ctx: { dryRun: boolean } }) => ({
    handledBy: "core" as const,
    payload: { channel: "workspace", to: "user:U123", via: "direct", dryRun: params.ctx.dryRun },
    toolResult: undefined,
    sendResult: undefined,
  })),
  executePollAction: vi.fn(),
}));

vi.mock("./outbound-send-service.js", () => ({
  executeSendAction: sendServiceMocks.executeSendAction,
  executePollAction: sendServiceMocks.executePollAction,
}));

const sessionMocks = vi.hoisted(() => ({
  ensureOutboundSessionEntry: vi.fn(async () => undefined),
  resolveOutboundSessionRoute: vi.fn(async () => ({
    sessionKey: "agent:main:workspace:channel:U123",
    baseSessionKey: "agent:main:workspace:channel:U123",
    peer: { kind: "direct" as const, id: "U123" },
    chatType: "direct" as const,
    from: "workspace:U123",
    to: "user:U123",
  })),
}));

vi.mock("./outbound-session.js", () => ({
  ensureOutboundSessionEntry: sessionMocks.ensureOutboundSessionEntry,
  resolveOutboundSessionRoute: sessionMocks.resolveOutboundSessionRoute,
}));

function registerWorkspacePlugin() {
  setActivePluginRegistry(
    createTestRegistry([
      {
        pluginId: "workspace",
        source: "test",
        plugin: workspaceTestPlugin,
      },
    ]),
  );
}

function broadcastText(result: Awaited<ReturnType<typeof runMessageAction>>): string {
  return formatMessageCliText(result).join("\n");
}

describe("message action delivery guards", () => {
  afterEach(() => {
    setActivePluginRegistry(createTestRegistry([]));
    sessionMocks.ensureOutboundSessionEntry.mockClear();
    sessionMocks.resolveOutboundSessionRoute.mockClear();
    sendServiceMocks.executeSendAction.mockClear();
  });

  it("reports broadcast dry runs as would-send and validates channel config", async () => {
    registerWorkspacePlugin();

    const result = await runMessageAction({
      cfg: {} as QuietCoreConfig,
      action: "broadcast",
      params: {
        channel: "workspace",
        targets: ["U123", "U456"],
        message: "hi",
        dryRun: true,
      },
    });

    if (result.kind !== "broadcast") {
      throw new Error(`expected broadcast result, got ${result.kind}`);
    }
    expect(result.dryRun).toBe(true);
    expect(result.handledBy).toBe("dry-run");
    expect(result.payload.results).toHaveLength(2);
    for (const entry of result.payload.results) {
      expect(entry.ok).toBe(false);
      expect(entry.dryRun).toBe(true);
      expect(entry.error).toMatch(/not configured/i);
    }

    const text = broadcastText(result);
    expect(text).not.toContain("succeeded");
    expect(text).toContain("would send");
    expect(text).toContain("not configured");
    expect(sessionMocks.ensureOutboundSessionEntry).not.toHaveBeenCalled();
    expect(sessionMocks.resolveOutboundSessionRoute).not.toHaveBeenCalled();
  });

  it("reports configured broadcast dry runs as would-send without success wording", async () => {
    registerWorkspacePlugin();

    const result = await runMessageAction({
      cfg: workspaceConfig,
      action: "broadcast",
      params: {
        channel: "workspace",
        targets: ["U123", "U456"],
        message: "hi",
        dryRun: true,
      },
    });

    if (result.kind !== "broadcast") {
      throw new Error(`expected broadcast result, got ${result.kind}`);
    }
    expect(result.dryRun).toBe(true);
    expect(result.payload.results.map((entry) => entry.ok)).toEqual([true, true]);
    expect(result.payload.results.every((entry) => entry.dryRun === true)).toBe(true);

    const text = broadcastText(result);
    expect(text).not.toContain("succeeded");
    expect(text).toContain("would send");
  });

  it("keeps real broadcast aggregation and success reporting intact", async () => {
    registerWorkspacePlugin();

    const result = await runMessageAction({
      cfg: workspaceConfig,
      action: "broadcast",
      params: {
        channel: "workspace",
        targets: ["U123", "U456"],
        message: "hi",
      },
    });

    if (result.kind !== "broadcast") {
      throw new Error(`expected broadcast result, got ${result.kind}`);
    }
    expect(result.dryRun).toBe(false);
    expect(result.handledBy).toBe("core");
    expect(result.payload.results.map((entry) => entry.ok)).toEqual([true, true]);

    const text = broadcastText(result);
    expect(text).toContain("succeeded");
    expect(text).not.toContain("would send");
  });

  it("skips the outbound session entry when the channel is not configured", async () => {
    registerWorkspacePlugin();

    const result = await runMessageAction({
      cfg: {} as QuietCoreConfig,
      action: "send",
      params: {
        channel: "workspace",
        target: "U123",
        message: "hi",
      },
      agentId: "main",
    });

    expect(result.kind).toBe("send");
    expect(sessionMocks.resolveOutboundSessionRoute).toHaveBeenCalled();
    expect(sessionMocks.ensureOutboundSessionEntry).not.toHaveBeenCalled();
  });

  it("still writes the outbound session entry for a configured channel", async () => {
    registerWorkspacePlugin();

    const result = await runMessageAction({
      cfg: workspaceConfig,
      action: "send",
      params: {
        channel: "workspace",
        target: "U123",
        message: "hi",
      },
      agentId: "main",
    });

    expect(result.kind).toBe("send");
    expect(sessionMocks.ensureOutboundSessionEntry).toHaveBeenCalledTimes(1);
  });
});
