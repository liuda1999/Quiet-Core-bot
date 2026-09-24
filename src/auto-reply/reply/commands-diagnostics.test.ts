// Tests diagnostics command output and runtime diagnostic toggles.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { clearPluginCommands } from "../../plugins/commands.js";
import type { MsgContext } from "../templating.js";
import { createDiagnosticsCommandHandler } from "./commands-diagnostics.js";
import type { HandleCommandsParams } from "./commands-types.js";

type ExecCall = {
  defaults: unknown;
  params: unknown;
};

type ExecDefaults = {
  accountId?: string;
  approvalFollowup?: () => Promise<string | undefined>;
  approvalFollowupMode?: string;
  approvalFollowupText?: string;
  approvalWarningText?: string;
  ask?: string;
  currentChannelId?: string;
  host?: string;
  messageProvider?: string;
  security?: string;
  trigger?: string;
};

type ExecParams = {
  ask?: string;
  command?: string;
  security?: string;
};

function requireExecCall(execCalls: ExecCall[], index = 0) {
  const call = execCalls[index];
  if (!call) {
    throw new Error(`expected exec call #${index + 1}`);
  }
  return {
    defaults: call.defaults as ExecDefaults,
    params: call.params as ExecParams,
  };
}

function buildDiagnosticsParams(
  commandBodyNormalized: string,
  overrides: Partial<HandleCommandsParams> = {},
): HandleCommandsParams {
  return {
    cfg: { commands: { text: true } } as OpenClawConfig,
    ctx: {
      Provider: "whatsapp",
      Surface: "whatsapp",
      CommandSource: "text",
      AccountId: "account-1",
      MessageThreadId: "thread-1",
    } as MsgContext,
    command: {
      commandBodyNormalized,
      isAuthorizedSender: true,
      senderIsOwner: true,
      senderId: "user-1",
      channel: "whatsapp",
      channelId: "whatsapp",
      surface: "whatsapp",
      ownerList: [],
      rawBodyNormalized: commandBodyNormalized,
      from: "user-1",
      to: "bot",
    },
    sessionKey: "agent:main:whatsapp:direct:user-1",
    workspaceDir: "/tmp",
    provider: "openai",
    model: "gpt-5.4",
    contextTokens: 0,
    defaultGroupActivation: () => "mention",
    resolvedVerboseLevel: "off",
    resolvedReasoningLevel: "off",
    resolveDefaultThinkingLevel: async () => undefined,
    isGroup: false,
    directives: {},
    elevated: { enabled: true, allowed: true, failures: [] },
    ...overrides,
  } as HandleCommandsParams;
}

function createDiagnosticsHandlerForTest(
  options: {
    privateTargets?: Array<{ channel: string; to: string; accountId?: string | null }>;
    execResult?: {
      content: Array<{ type: "text"; text: string }>;
      details?: { status: string; [key: string]: unknown };
    };
  } = {},
) {
  const execCalls: ExecCall[] = [];
  const privateReplies: Array<{
    targets: Array<{ channel: string; to: string; accountId?: string | null }>;
    text?: string;
  }> = [];
  const createExecTool = vi.fn((defaults: unknown) => ({
    execute: vi.fn(async (_toolCallId: string, params: unknown) => {
      execCalls.push({ defaults, params });
      return (
        options.execResult ?? {
          content: [
            {
              type: "text" as const,
              text: "Exec approval pending. Allowed decisions: allow-once, deny.",
            },
          ],
          details: {
            status: "approval-pending" as const,
            approvalId: "approval-1",
            approvalSlug: "diag-approval",
            expiresAtMs: Date.now() + 60_000,
            allowedDecisions: ["allow-once", "deny"] as const,
            host: "gateway" as const,
            command: "openclaw gateway diagnostics export --json",
            cwd: "/tmp",
          },
        }
      );
    }),
  }));
  return {
    execCalls,
    privateReplies,
    handleDiagnosticsCommand: createDiagnosticsCommandHandler({
      createExecTool: createExecTool as never,
      resolvePrivateDiagnosticsTargets: vi.fn(async () => options.privateTargets ?? []),
      deliverPrivateDiagnosticsReply: vi.fn(async ({ targets, reply }) => {
        privateReplies.push({ targets, text: reply.text });
        return true;
      }),
    }),
  };
}

afterEach(() => {
  clearPluginCommands();
});

describe("diagnostics command", () => {
  it("requests Gateway diagnostics approval without a duplicate pending chat reply", async () => {
    const { execCalls, handleDiagnosticsCommand } = createDiagnosticsHandlerForTest();
    const result = await handleDiagnosticsCommand(buildDiagnosticsParams("/diagnostics"), true);

    expect(result?.shouldContinue).toBe(false);
    expect(result?.reply).toBeUndefined();
    expect(execCalls).toHaveLength(1);
    const execCall = requireExecCall(execCalls);
    expect(execCall.defaults.host).toBe("gateway");
    expect(execCall.defaults.security).toBe("allowlist");
    expect(execCall.defaults.ask).toBe("always");
    expect(execCall.defaults.trigger).toBe("diagnostics");
    expect(execCall.defaults.approvalFollowupMode).toBe("direct");
    expect(execCall.defaults.approvalWarningText).toContain(
      "Diagnostics can include sensitive local logs and host-level runtime metadata.",
    );
    expect(execCall.defaults.approvalWarningText).toContain(
      "https://docs.openclaw.ai/gateway/diagnostics",
    );
    expect(execCall.params.security).toBe("allowlist");
    expect(execCall.params.ask).toBe("always");
    const command = execCall.params.command ?? "";
    expect(command).toContain("gateway");
    expect(command).toContain("diagnostics");
    expect(command).toContain("export");
    expect(command).toContain("--json");
    expect(command).not.toBe("openclaw gateway diagnostics export --json");
  });

  it("uses the originating Telegram route for native diagnostics followups", async () => {
    const { execCalls, handleDiagnosticsCommand } = createDiagnosticsHandlerForTest();
    const params = buildDiagnosticsParams("/diagnostics", {
      ctx: {
        Provider: "telegram",
        Surface: "telegram",
        OriginatingChannel: "telegram",
        OriginatingTo: "telegram:8460800771",
        From: "telegram:8460800771",
        To: "slash:8460800771",
        CommandSource: "native",
        AccountId: "account-1",
      } as MsgContext,
      command: {
        commandBodyNormalized: "/diagnostics",
        isAuthorizedSender: true,
        senderIsOwner: true,
        senderId: "8460800771",
        channel: "telegram",
        channelId: "telegram",
        surface: "telegram",
        ownerList: [],
        rawBodyNormalized: "/diagnostics",
        from: "telegram:8460800771",
        to: "slash:8460800771",
      },
      sessionKey: "agent:main:telegram:slash:8460800771",
    });

    await handleDiagnosticsCommand(params, true);

    expect(execCalls).toHaveLength(1);
    const execCall = requireExecCall(execCalls);
    expect(execCall.defaults.messageProvider).toBe("telegram");
    expect(execCall.defaults.currentChannelId).toBe("telegram:8460800771");
    expect(execCall.defaults.accountId).toBe("account-1");
  });

  it("falls back to a visible reply when approval cannot be queued", async () => {
    const { execCalls, handleDiagnosticsCommand } = createDiagnosticsHandlerForTest({
      execResult: {
        content: [
          {
            type: "text",
            text: "Exec approval is required, but no interactive approval client is currently available.",
          },
        ],
        details: {
          status: "approval-unavailable",
          reason: "no-approval-route",
        },
      },
    });
    const result = await handleDiagnosticsCommand(buildDiagnosticsParams("/diagnostics"), true);

    expect(result?.shouldContinue).toBe(false);
    expect(result?.reply?.text).toContain(
      "Diagnostics can include sensitive local logs and host-level runtime metadata.",
    );
    expect(result?.reply?.text).toContain("https://docs.openclaw.ai/gateway/diagnostics");
    expect(result?.reply?.text).toContain("no interactive approval client");
    expect(execCalls).toHaveLength(1);
  });

  it("requires an owner for diagnostics", async () => {
    const { handleDiagnosticsCommand } = createDiagnosticsHandlerForTest();
    const result = await handleDiagnosticsCommand(
      buildDiagnosticsParams("/diagnostics", {
        command: {
          ...buildDiagnosticsParams("/diagnostics").command,
          senderIsOwner: false,
        },
      }),
      true,
    );

    expect(result).toEqual({ shouldContinue: false });
  });

});
