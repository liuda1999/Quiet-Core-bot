// Dev Tooling Safety tests cover dev tooling safety script behavior.
import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testing as claudeUsageTesting } from "../../scripts/debug-claude-usage.ts";
import { testing as discordSmokeTesting } from "../../scripts/dev/discord-acp-plain-language-smoke.ts";
import { testing as tuiPtyWatchTesting } from "../../scripts/dev/tui-pty-test-watch.ts";
import {
  maskIdentifier,
  parseBooleanEnv,
  parseStrictIntegerOption,
  previewForDevToolLog,
  redactHomePath,
  redactJsonValueForDevToolLog,
} from "../../scripts/lib/dev-tooling-safety.ts";
import { resolveWindowsTaskkillPath } from "../../scripts/lib/windows-taskkill.mjs";

const tempDirs: string[] = [];

function expectedTaskkillPath(): string {
  return resolveWindowsTaskkillPath();
}

afterEach(async () => {
  vi.useRealTimers();
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { force: true, recursive: true });
  }
});

describe("dev tooling safety helpers", () => {
  it("redacts secrets before truncating script log previews", () => {
    const token = "sk-test1234567890abcdefghijklmnop"; // pragma: allowlist secret
    const preview = previewForDevToolLog(`prefix OPENAI_API_KEY=${token} suffix`, 80);

    expect(preview).not.toContain(token);
    expect(preview).toContain("OPENAI_API_KEY=");
  });

  it("recursively redacts JSON-ish detail values before printing smoke results", () => {
    const token = "sk-test1234567890abcdefghijklmnop"; // pragma: allowlist secret
    const redacted = redactJsonValueForDevToolLog({
      nested: [{ message: `Authorization: Bearer ${token}` }],
    }) as { nested: Array<{ message: string }> };

    expect(redacted.nested[0].message).not.toContain(token);
    expect(redacted.nested[0].message).toContain("Authorization");
  });

  it("parses boolean env values explicitly", () => {
    expect(parseBooleanEnv({ fallback: false, name: "FLAG", raw: "yes" })).toBe(true);
    expect(parseBooleanEnv({ fallback: true, name: "FLAG", raw: "0" })).toBe(false);
    expect(() => parseBooleanEnv({ fallback: false, name: "FLAG", raw: "maybe" })).toThrow(
      /FLAG must be one of/u,
    );
  });

  it("rejects partial numeric option parses", () => {
    expect(parseStrictIntegerOption({ fallback: 3, label: "--runs", min: 1, raw: undefined })).toBe(
      3,
    );
    expect(() =>
      parseStrictIntegerOption({ fallback: 3, label: "--runs", min: 1, raw: "2abc" }),
    ).toThrow(/--runs must be an integer/u);
  });

  it("redacts home paths and masks opaque ids", () => {
    // redactHomePath slices the resolved path, so separators follow the host platform.
    expect(redactHomePath("/home/alice/.quiet-core-bot/state.json", "/home/alice")).toBe(
      path.join("~", ".quiet-core-bot", "state.json"),
    );
    expect(maskIdentifier("session-key-abcdef123456")).toBe("sessio...3456");
  });
});

describe("script-specific dev tooling hardening", () => {
  it("rejects unknown Discord smoke drivers instead of silently using token mode", () => {
    expect(discordSmokeTesting.parseDriverMode("webhook")).toBe("webhook");
    expect(() => discordSmokeTesting.parseDriverMode("curl")).toThrow(/Invalid --driver/u);
  });

  it("rejects unknown Discord smoke args before live Discord/QuietCore work", () => {
    expect(() => discordSmokeTesting.parseArgs(["--wat"])).toThrow("Unknown argument: --wat");

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/dev/discord-acp-plain-language-smoke.ts", "--wat"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("Unknown argument: --wat");
  });

  it("prints Discord smoke usage without starting live validation", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/dev/discord-acp-plain-language-smoke.ts", "--help"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: bun scripts/dev/discord-acp-plain-language-smoke.ts");
    expect(result.stderr).toBe("");
  });

  it("rejects missing Discord smoke option values before env fallbacks", () => {
    expect(() => discordSmokeTesting.parseArgs(["--channel"])).toThrow(
      "--channel requires a value",
    );
    expect(() => discordSmokeTesting.parseArgs(["--channel="])).toThrow(
      "--channel requires a value",
    );
    expect(() => discordSmokeTesting.parseArgs(["--channel", "--json"])).toThrow(
      "--channel requires a value",
    );
    for (const flag of ["--channel", "--token", "--timeout-ms", "--state-dir"]) {
      expect(() => discordSmokeTesting.parseArgs([flag, "-h"])).toThrow(`${flag} requires a value`);
    }
  });

  it("redacts Discord webhook tokens from API paths", () => {
    const token = "webhook-secret-token-abcdef123456"; // pragma: allowlist secret
    const apiPath = `/webhooks/123/${token}?wait=true`;

    expect(discordSmokeTesting.redactDiscordApiPath(apiPath)).not.toContain(token);
    expect(discordSmokeTesting.redactDiscordApiPath(apiPath)).toContain("/webhooks/123/");
  });

  it("computes the remaining Discord smoke timeout budget", () => {
    expect(discordSmokeTesting.remainingTimeoutMs(1_500, 1_000)).toBe(500);
    expect(() => discordSmokeTesting.remainingTimeoutMs(1_000, 1_000)).toThrow(
      /exceeded total timeout/u,
    );
  });

  it("aborts stalled Discord smoke fetches at the request timeout", async () => {
    let signal: AbortSignal | undefined;
    const request = discordSmokeTesting.requestDiscordJson({
      method: "GET",
      path: "/users/@me",
      headers: {},
      retries: 0,
      timeoutMs: 5,
      errorPrefix: "Discord API",
      fetchImpl: ((_url, init) => {
        signal = init?.signal ?? undefined;
        return new Promise(() => {});
      }) as typeof fetch,
    });

    await expect(request).rejects.toThrow(/Discord API GET \/users\/@me exceeded timeout/u);
    expect(signal?.aborted).toBe(true);
  });

  it("times out stalled Discord smoke response body reads", async () => {
    const response = new Response(
      new ReadableStream({
        start() {},
      }),
      { status: 200, statusText: "OK" },
    );
    const request = discordSmokeTesting.requestDiscordJson({
      method: "GET",
      path: "/channels/123/messages",
      headers: {},
      retries: 0,
      timeoutMs: 5,
      errorPrefix: "Discord API",
      fetchImpl: (() => Promise.resolve(response)) as typeof fetch,
    });

    await expect(request).rejects.toThrow(
      /Discord API GET \/channels\/123\/messages exceeded timeout/u,
    );
  });

  it("bounds Discord smoke response bodies by content-length", async () => {
    const response = new Response("{}", {
      headers: { "content-length": "6" },
    });
    const request = discordSmokeTesting.requestDiscordJson({
      method: "GET",
      path: "/channels/123/messages",
      headers: {},
      retries: 0,
      timeoutMs: 50,
      responseBodyMaxBytes: 5,
      errorPrefix: "Discord API",
      fetchImpl: (() => Promise.resolve(response)) as typeof fetch,
    });

    await expect(request).rejects.toThrow(
      "Discord API GET /channels/123/messages response body exceeded 5 bytes",
    );
  });

  it("bounds Discord smoke response bodies by streamed bytes", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(6));
          controller.close();
        },
      }),
    );
    const request = discordSmokeTesting.requestDiscordJson({
      method: "GET",
      path: "/channels/123/messages",
      headers: {},
      retries: 0,
      timeoutMs: 50,
      responseBodyMaxBytes: 5,
      errorPrefix: "Discord API",
      fetchImpl: (() => Promise.resolve(response)) as typeof fetch,
    });

    await expect(request).rejects.toThrow(
      "Discord API GET /channels/123/messages response body exceeded 5 bytes",
    );
  });

  it("does not launch another Discord smoke retry after the timeout budget expires", async () => {
    let calls = 0;
    const response = {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({ retry_after: 1 }),
    } as Response;

    await expect(
      discordSmokeTesting.requestDiscordJson({
        method: "GET",
        path: "/channels/123/messages",
        headers: {},
        retries: 1,
        timeoutMs: 5,
        errorPrefix: "Discord API",
        fetchImpl: (() => {
          calls += 1;
          return Promise.resolve(response);
        }) as typeof fetch,
      }),
    ).rejects.toThrow(/exceeded total timeout/u);
    expect(calls).toBe(1);
  });

  it("prints TUI PTY watch usage without launching the watcher", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/dev/tui-pty-test-watch.ts", "--help"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: node --import tsx scripts/dev/tui-pty-test-watch.ts");
    expect(result.stderr).toBe("");
  });

  it("rejects unknown TUI PTY watch args before launching the watcher", () => {
    expect(() => tuiPtyWatchTesting.parseOptions(["--wat"])).toThrow("Unknown argument: --wat");

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/dev/tui-pty-test-watch.ts", "--wat"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("Unknown argument: --wat");
    expect(result.stdout).toBe("");
  });

  it("rejects short flags as TUI PTY watch option values", () => {
    for (const flag of ["--mode", "--mirror-path"]) {
      expect(() => tuiPtyWatchTesting.parseOptions([flag, "-h"])).toThrow(
        `${flag} requires a value`,
      );
    }
  });

  it("keeps TUI PTY watch vitest args behind the separator", () => {
    expect(tuiPtyWatchTesting.parseOptions(["--mode", "all", "--", "--help"])).toMatchObject({
      mode: "all",
      vitestArgs: ["--help"],
    });
  });

  it("escalates stalled TUI PTY watch children after interrupt cleanup", async () => {
    vi.useFakeTimers();
    const signals: NodeJS.Signals[] = [];
    const stopper = tuiPtyWatchTesting.createChildStopper(
      { kill: () => true },
      {
        signalChild(_child, signal: NodeJS.Signals): void {
          signals.push(signal);
        },
        sigkillGraceMs: 20,
        sigtermGraceMs: 10,
      },
    );

    stopper.stop();
    expect(signals).toEqual(["SIGINT"]);

    await vi.advanceTimersByTimeAsync(10);
    expect(signals).toEqual(["SIGINT", "SIGTERM"]);

    await vi.advanceTimersByTimeAsync(20);
    expect(signals).toEqual(["SIGINT", "SIGTERM", "SIGKILL"]);
  });

  it("reads TUI PTY mirror updates incrementally with a bounded chunk", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-tui-watch-test-"));
    tempDirs.push(tempRoot);
    const mirrorPath = path.join(tempRoot, "mirror.ansi");
    await fs.writeFile(mirrorPath, "first-second-third", "utf8");

    const first = await tuiPtyWatchTesting.readNewMirrorData(mirrorPath, 0, 6);
    expect(first.chunk.toString("utf8")).toBe("first-");
    expect(first.offset).toBe(6);

    const second = await tuiPtyWatchTesting.readNewMirrorData(mirrorPath, first.offset, 6);
    expect(second.chunk.toString("utf8")).toBe("second");
    expect(second.offset).toBe(12);
  });

  it("restarts TUI PTY mirror reads when the mirror file is truncated", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-tui-watch-test-"));
    tempDirs.push(tempRoot);
    const mirrorPath = path.join(tempRoot, "mirror.ansi");
    await fs.writeFile(mirrorPath, "fresh", "utf8");

    const result = await tuiPtyWatchTesting.readNewMirrorData(mirrorPath, 10, 1024);

    expect(result.chunk.toString("utf8")).toBe("fresh");
    expect(result.offset).toBe(5);
  });

  it("drains all pending TUI PTY mirror chunks after the child exits", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-tui-watch-test-"));
    tempDirs.push(tempRoot);
    const mirrorPath = path.join(tempRoot, "mirror.ansi");
    await fs.writeFile(mirrorPath, "first-second-third", "utf8");
    const chunks: string[] = [];

    const offset = await tuiPtyWatchTesting.drainNewMirrorData(
      mirrorPath,
      0,
      (chunk: Buffer) => chunks.push(chunk.toString("utf8")),
      6,
    );

    expect(chunks).toEqual(["first-", "second", "-third"]);
    expect(offset).toBe("first-second-third".length);
  });

  it("keeps only diagnostic tails from noisy TUI PTY child output", () => {
    const retained = tuiPtyWatchTesting.appendBufferTail(
      Buffer.from("0123456789", "utf8"),
      Buffer.from("abcdef", "utf8"),
      8,
    );

    expect(retained.toString("utf8")).toBe("89abcdef");
  });

  it.runIf(process.platform !== "win32")(
    "signals the TUI PTY watch process group before falling back to the child",
    () => {
      const kill = vi.spyOn(process, "kill").mockReturnValue(true);
      const childKill = vi.fn(() => true);

      try {
        tuiPtyWatchTesting.signalChildProcessTree({ pid: 123, kill: childKill }, "SIGTERM");
        expect(kill).toHaveBeenCalledWith(-123, "SIGTERM");
        expect(childKill).not.toHaveBeenCalled();
      } finally {
        kill.mockRestore();
      }
    },
  );

  it.runIf(process.platform !== "win32")(
    "falls back to direct TUI PTY watch child signaling when the process group is gone",
    () => {
      const kill = vi.spyOn(process, "kill").mockImplementation(() => {
        const error = new Error("missing process group") as NodeJS.ErrnoException;
        error.code = "ESRCH";
        throw error;
      });
      const childKill = vi.fn(() => true);

      try {
        tuiPtyWatchTesting.signalChildProcessTree({ pid: 123, kill: childKill }, "SIGTERM");
        expect(kill).toHaveBeenCalledWith(-123, "SIGTERM");
        expect(childKill).toHaveBeenCalledWith("SIGTERM");
      } finally {
        kill.mockRestore();
      }
    },
  );

  it("signals Windows TUI PTY watch process trees with taskkill", () => {
    const childKill = vi.fn(() => true);
    const runTaskkill = vi.fn(() => ({ error: undefined, status: 0 }));

    tuiPtyWatchTesting.signalChildProcessTree({ pid: 123, kill: childKill }, "SIGTERM", {
      platform: "win32",
      runTaskkill,
    });
    expect(runTaskkill).toHaveBeenNthCalledWith(1, expectedTaskkillPath(), ["/PID", "123", "/T"], {
      stdio: "ignore",
    });

    tuiPtyWatchTesting.signalChildProcessTree({ pid: 123, kill: childKill }, "SIGKILL", {
      platform: "win32",
      runTaskkill,
    });
    expect(runTaskkill).toHaveBeenNthCalledWith(
      2,
      expectedTaskkillPath(),
      ["/PID", "123", "/T", "/F"],
      {
        stdio: "ignore",
      },
    );
    expect(childKill).not.toHaveBeenCalled();
  });

  it("force-kills Windows TUI PTY watch process trees when graceful taskkill fails", () => {
    const childKill = vi.fn(() => true);
    const runTaskkill = vi
      .fn()
      .mockReturnValueOnce({ error: undefined, status: 1 })
      .mockReturnValueOnce({ error: undefined, status: 0 });

    tuiPtyWatchTesting.signalChildProcessTree({ pid: 123, kill: childKill }, "SIGTERM", {
      platform: "win32",
      runTaskkill,
    });

    expect(runTaskkill).toHaveBeenNthCalledWith(1, expectedTaskkillPath(), ["/PID", "123", "/T"], {
      stdio: "ignore",
    });
    expect(runTaskkill).toHaveBeenNthCalledWith(
      2,
      expectedTaskkillPath(),
      ["/PID", "123", "/T", "/F"],
      {
        stdio: "ignore",
      },
    );
    expect(childKill).not.toHaveBeenCalled();
  });

  it("uses exact Claude cookie host matchers instead of broad substring matches", () => {
    expect(claudeUsageTesting.CLAUDE_COOKIE_HOST_SQL).toContain("host_key = 'claude.ai'");
    expect(claudeUsageTesting.CLAUDE_COOKIE_HOST_SQL).toContain("LIKE '%.claude.ai'");
    expect(claudeUsageTesting.CLAUDE_COOKIE_HOST_SQL).not.toContain("%claude.ai%");
  });

  it("rejects malformed Claude usage args before reading auth or browser state", () => {
    expect(claudeUsageTesting.parseArgs(["--agent", "work", "--session-key=abc"])).toEqual({
      agentId: "work",
      help: false,
      reveal: false,
      sessionKey: "abc",
    });
    expect(claudeUsageTesting.parseArgs(["--help"])).toEqual({
      agentId: "main",
      help: true,
      reveal: false,
      sessionKey: undefined,
    });
    expect(() => claudeUsageTesting.parseArgs(["--wat"])).toThrow("Unknown argument: --wat");
    expect(() => claudeUsageTesting.parseArgs(["--agent"])).toThrow("--agent requires a value");
    expect(() => claudeUsageTesting.parseArgs(["--agent="])).toThrow("--agent requires a value");
    expect(() => claudeUsageTesting.parseArgs(["--session-key", "--reveal"])).toThrow(
      "--session-key requires a value",
    );
    expect(() => claudeUsageTesting.parseArgs(["--session-key= "])).toThrow(
      "--session-key requires a value",
    );
  });

  it("prints Claude usage help without opening auth stores", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/debug-claude-usage.ts", "--help"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: node --import tsx scripts/debug-claude-usage.ts");
    expect(result.stderr).toBe("");
  });

  it("fails missing Claude usage option values before defaulting to main auth", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/debug-claude-usage.ts", "--agent"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--agent requires a value");
  });

  it("aborts stalled Claude usage fetches at the request timeout", async () => {
    let signal: AbortSignal | undefined;
    const request = claudeUsageTesting.fetchAnthropicOAuthUsage("test-token", {
      timeoutMs: 5,
      fetchImpl: ((_url, init) => {
        signal = init?.signal ?? undefined;
        return new Promise(() => {});
      }) as typeof fetch,
    });

    await expect(request).rejects.toThrow(/Anthropic OAuth usage request exceeded timeout/u);
    expect(signal?.aborted).toBe(true);
  });

  it("times out stalled Claude usage response body reads", async () => {
    const response = new Response(
      new ReadableStream({
        start() {},
      }),
      { headers: { "content-type": "application/json" } },
    );
    const request = claudeUsageTesting.fetchAnthropicOAuthUsage("test-token", {
      timeoutMs: 5,
      fetchImpl: (() => Promise.resolve(response)) as typeof fetch,
    });

    await expect(request).rejects.toThrow(/Anthropic OAuth usage request exceeded timeout/u);
  });

  it("rejects invalid Claude usage timeout values", () => {
    expect(claudeUsageTesting.resolveFetchTimeoutMs("123")).toBe(123);
    expect(() => claudeUsageTesting.resolveFetchTimeoutMs("1.5")).toThrow(
      /QUIET_CORE_DEBUG_CLAUDE_USAGE_FETCH_TIMEOUT_MS must be an integer/u,
    );
  });

  it("bounds Claude usage response body reads by content-length", async () => {
    const maxBytes = claudeUsageTesting.FETCH_RESPONSE_MAX_BYTES;
    const response = new Response("{}", {
      headers: { "content-length": String(maxBytes + 1) },
    });
    const controller = new AbortController();

    await expect(
      claudeUsageTesting.readBoundedResponseText(
        response,
        "Claude usage test",
        controller.signal,
        maxBytes,
      ),
    ).rejects.toThrow(`Claude usage test response body exceeded ${maxBytes} bytes`);
  });

  it("bounds Claude usage response body reads by streamed bytes", async () => {
    const maxBytes = claudeUsageTesting.FETCH_RESPONSE_MAX_BYTES;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(maxBytes + 1));
          controller.close();
        },
      }),
    );
    const controller = new AbortController();

    await expect(
      claudeUsageTesting.readBoundedResponseText(
        response,
        "Claude usage test",
        controller.signal,
        maxBytes,
      ),
    ).rejects.toThrow(`Claude usage test response body exceeded ${maxBytes} bytes`);
  });
});
