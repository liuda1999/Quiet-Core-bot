// Daemon inspect tests cover service inspection and diagnostic output.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectMarkerLineWithGateway, findExtraGatewayServices } from "./inspect.js";

const { execSchtasksMock } = vi.hoisted(() => ({
  execSchtasksMock: vi.fn(),
}));

vi.mock("./schtasks-exec.js", () => ({
  execSchtasks: (...args: unknown[]) => execSchtasksMock(...args),
}));

// Real content from the quiet-core-bot-gateway.service unit file (the canonical gateway unit).
const GATEWAY_SERVICE_CONTENTS = `\
[Unit]
Description=Quiet Core bot Gateway (v2026.3.8)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/node /home/quiet-core-bot/.npm-global/lib/node_modules/quiet-core-bot/dist/entry.js gateway --port 18789
Restart=always
Environment=QUIET_CORE_SERVICE_MARKER=quiet-core-bot
Environment=QUIET_CORE_SERVICE_KIND=gateway
Environment=QUIET_CORE_SERVICE_VERSION=2026.3.8

[Install]
WantedBy=default.target
`;

// Real content from the quiet-core-bot-test.service unit file (a non-gateway quiet-core-bot service).
const TEST_SERVICE_CONTENTS = `\
[Unit]
Description=Quiet Core bot test service
After=default.target

[Service]
Type=simple
ExecStart=/bin/sh -c 'while true; do sleep 60; done'
Restart=on-failure

[Install]
WantedBy=default.target
`;

const CLAWDBOT_GATEWAY_CONTENTS = `\
[Unit]
Description=Clawdbot Gateway
[Service]
ExecStart=/usr/bin/node /opt/clawdbot/dist/entry.js gateway --port 18789
Environment=HOME=/home/clawdbot
`;

const COMPANION_SERVICE_CONTENTS = `\
[Unit]
Description=Quiet Core bot companion worker
After=quiet-core-bot-gateway.service
Requires=quiet-core-bot-gateway.service

[Service]
ExecStart=/usr/bin/node /opt/quiet-core-bot-worker/dist/index.js worker
`;

const CUSTOM_QUIET_CORE_GATEWAY_CONTENTS = `\
[Unit]
Description=Custom Quiet Core bot gateway

[Service]
ExecStart=/usr/bin/node /opt/quiet-core-bot/dist/entry.js gateway --port 18888
`;

describe("detectMarkerLineWithGateway", () => {
  it("returns null for quiet-core-bot-test.service (quiet-core-bot only in description, no gateway on same line)", () => {
    expect(detectMarkerLineWithGateway(TEST_SERVICE_CONTENTS)).toBeNull();
  });

  it("returns quiet-core-bot for the canonical gateway unit (ExecStart has both quiet-core-bot and gateway)", () => {
    expect(detectMarkerLineWithGateway(GATEWAY_SERVICE_CONTENTS)).toBe("quiet-core-bot");
  });

  it("returns clawdbot for a clawdbot gateway unit", () => {
    expect(detectMarkerLineWithGateway(CLAWDBOT_GATEWAY_CONTENTS)).toBe("clawdbot");
  });

  it("handles line continuations — marker and gateway split across physical lines", () => {
    const contents = `[Service]\nExecStart=/usr/bin/node /opt/quiet-core-bot/dist/entry.js \\\n  gateway --port 18789\n`;
    expect(detectMarkerLineWithGateway(contents)).toBe("quiet-core-bot");
  });

  it("ignores dependency-only references to the gateway unit", () => {
    expect(detectMarkerLineWithGateway(COMPANION_SERVICE_CONTENTS)).toBeNull();
  });

  it("ignores non-gateway ExecStart commands that only pass gateway-named options", () => {
    const contents = `[Service]\nExecStart=/usr/bin/quiet-core-bot-helper --gateway-url http://127.0.0.1:18789 sync\n`;
    expect(detectMarkerLineWithGateway(contents)).toBeNull();
  });
});

describe("findExtraGatewayServices (linux / scanSystemdDir) — real filesystem", () => {
  // These tests write real .service files to a temp dir and call findExtraGatewayServices
  // with that dir as HOME. No platform mocking or fs mocking needed.
  // Only runs on Linux/macOS where the linux branch of findExtraGatewayServices is active.
  const isLinux = process.platform === "linux";

  it.skipIf(!isLinux)("does not report quiet-core-bot-test.service as a gateway service", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    try {
      await fs.mkdir(systemdDir, { recursive: true });
      await fs.writeFile(path.join(systemdDir, "quiet-core-bot-test.service"), TEST_SERVICE_CONTENTS);
      const result = await findExtraGatewayServices({ HOME: tmpHome });
      expect(result).toStrictEqual([]);
    } finally {
      await fs.rm(tmpHome, { recursive: true, force: true });
    }
  });

  it.skipIf(!isLinux)(
    "does not report the canonical quiet-core-bot-gateway.service as an extra service",
    async () => {
      const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
      const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
      try {
        await fs.mkdir(systemdDir, { recursive: true });
        await fs.writeFile(
          path.join(systemdDir, "quiet-core-bot-gateway.service"),
          GATEWAY_SERVICE_CONTENTS,
        );
        const result = await findExtraGatewayServices({ HOME: tmpHome });
        expect(result).toStrictEqual([]);
      } finally {
        await fs.rm(tmpHome, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!isLinux)(
    "reports a legacy clawdbot-gateway service as an extra gateway service",
    async () => {
      const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
      const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
      const unitPath = path.join(systemdDir, "clawdbot-gateway.service");
      try {
        await fs.mkdir(systemdDir, { recursive: true });
        await fs.writeFile(unitPath, CLAWDBOT_GATEWAY_CONTENTS);
        const result = await findExtraGatewayServices({ HOME: tmpHome });
        expect(result).toEqual([
          {
            platform: "linux",
            label: "clawdbot-gateway.service",
            detail: `unit: ${unitPath}`,
            scope: "user",
            marker: "clawdbot",
            legacy: true,
          },
        ]);
      } finally {
        await fs.rm(tmpHome, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!isLinux)(
    "does not report companion units that only depend on the gateway",
    async () => {
      const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
      const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
      try {
        await fs.mkdir(systemdDir, { recursive: true });
        await fs.writeFile(
          path.join(systemdDir, "quiet-core-bot-companion.service"),
          COMPANION_SERVICE_CONTENTS,
        );
        const result = await findExtraGatewayServices({ HOME: tmpHome });
        expect(result).toStrictEqual([]);
      } finally {
        await fs.rm(tmpHome, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!isLinux)(
    "reports custom-named gateway units that execute quiet-core-bot gateway",
    async () => {
      const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
      const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
      const unitPath = path.join(systemdDir, "custom-quiet-core-bot.service");
      try {
        await fs.mkdir(systemdDir, { recursive: true });
        await fs.writeFile(unitPath, CUSTOM_QUIET_CORE_GATEWAY_CONTENTS);
        const result = await findExtraGatewayServices({ HOME: tmpHome });
        expect(result).toEqual([
          {
            platform: "linux",
            label: "custom-quiet-core-bot.service",
            detail: `unit: ${unitPath}`,
            scope: "user",
            marker: "quiet-core-bot",
            legacy: false,
          },
        ]);
      } finally {
        await fs.rm(tmpHome, { recursive: true, force: true });
      }
    },
  );
});

describe("findExtraGatewayServices (darwin / scanLaunchdDir) — real filesystem", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "darwin",
    });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("does not report LaunchAgent companions that only mention the gateway label", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
    const launchdDir = path.join(tmpHome, "Library", "LaunchAgents");
    try {
      await fs.mkdir(launchdDir, { recursive: true });
      await fs.writeFile(
        path.join(launchdDir, "com.example.companion.plist"),
        `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>Label</key><string>com.example.companion</string>
<key>KeepAlive</key><dict><key>OtherJobEnabled</key><dict><key>ai.quiet-core-bot.gateway</key><true/></dict></dict>
<key>ProgramArguments</key><array><string>/usr/local/bin/quiet-core-bot-helper</string><string>sync</string></array>
</dict></plist>`,
      );
      const result = await findExtraGatewayServices({ HOME: tmpHome });
      expect(result).toStrictEqual([]);
    } finally {
      await fs.rm(tmpHome, { recursive: true, force: true });
    }
  });

  it("does not report LaunchAgent companions that only pass gateway-named options", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
    const launchdDir = path.join(tmpHome, "Library", "LaunchAgents");
    try {
      await fs.mkdir(launchdDir, { recursive: true });
      await fs.writeFile(
        path.join(launchdDir, "com.example.companion-options.plist"),
        `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>Label</key><string>com.example.companion-options</string>
<key>ProgramArguments</key><array><string>/usr/local/bin/quiet-core-bot-helper</string><string>--gateway-url</string><string>http://127.0.0.1:18789</string><string>sync</string></array>
</dict></plist>`,
      );
      const result = await findExtraGatewayServices({ HOME: tmpHome });
      expect(result).toStrictEqual([]);
    } finally {
      await fs.rm(tmpHome, { recursive: true, force: true });
    }
  });

  it("does not report non-gateway LaunchAgents that mention clawdbot in environment values", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
    const launchdDir = path.join(tmpHome, "Library", "LaunchAgents");
    try {
      await fs.mkdir(launchdDir, { recursive: true });
      await fs.writeFile(
        path.join(launchdDir, "com.github.facebook.watchman.plist"),
        `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>Label</key><string>com.github.facebook.watchman</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/Users/test/Projects/clawdbot2/node_modules/.bin:/opt/homebrew/bin</string></dict>
<key>ProgramArguments</key><array><string>/opt/homebrew/bin/watchman</string><string>--foreground</string></array>
</dict></plist>`,
      );
      const result = await findExtraGatewayServices({ HOME: tmpHome });
      expect(result).toStrictEqual([]);
    } finally {
      await fs.rm(tmpHome, { recursive: true, force: true });
    }
  });

  it("reports custom LaunchAgents that execute quiet-core-bot gateway", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-test-"));
    const launchdDir = path.join(tmpHome, "Library", "LaunchAgents");
    const plistPath = path.join(launchdDir, "com.example.quiet-core-bot-gateway.plist");
    try {
      await fs.mkdir(launchdDir, { recursive: true });
      await fs.writeFile(
        plistPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>Label</key><string>com.example.quiet-core-bot-gateway</string>
<key>ProgramArguments</key><array><string>/usr/local/bin/openclaw</string><string>gateway</string><string>--port</string><string>18888</string></array>
</dict></plist>`,
      );
      const result = await findExtraGatewayServices({ HOME: tmpHome });
      expect(result).toEqual([
        {
          platform: "darwin",
          label: "com.example.quiet-core-bot-gateway",
          detail: `plist: ${plistPath}`,
          scope: "user",
          marker: "quiet-core-bot",
          legacy: false,
        },
      ]);
    } finally {
      await fs.rm(tmpHome, { recursive: true, force: true });
    }
  });
});

describe("findExtraGatewayServices (win32)", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });
    execSchtasksMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("skips schtasks queries unless deep mode is enabled", async () => {
    const result = await findExtraGatewayServices({});
    expect(result).toStrictEqual([]);
    expect(execSchtasksMock).not.toHaveBeenCalled();
  });

  it("returns empty results when schtasks query fails", async () => {
    execSchtasksMock.mockResolvedValueOnce({
      code: 1,
      stdout: "",
      stderr: "error",
    });

    const result = await findExtraGatewayServices({}, { deep: true });
    expect(result).toStrictEqual([]);
  });

  it("collects only non-quiet-core-bot marker tasks from schtasks output", async () => {
    // Real schtasks /Query /FO LIST /V output prefixes root-folder task
    // names with a backslash (e.g. TaskName:\Quiet Core bot Gateway).
    execSchtasksMock.mockResolvedValueOnce({
      code: 0,
      stdout: [
        "TaskName:\\Quiet Core bot Gateway",
        "Task To Run: C:\\Program Files\\Quiet Core bot\\quiet-core-bot.exe gateway run",
        "",
        "TaskName: Clawdbot Legacy",
        "Task To Run: C:\\clawdbot\\clawdbot.exe run",
        "",
        "TaskName: Other Task",
        "Task To Run: C:\\tools\\helper.exe",
        "",
      ].join("\n"),
      stderr: "",
    });

    const result = await findExtraGatewayServices({}, { deep: true });
    // The \Quiet Core bot Gateway task is the live launcher — it must be skipped.
    // Only the unrelated clawdbot task should be flagged.
    expect(result).toEqual([
      {
        platform: "win32",
        label: "Clawdbot Legacy",
        detail: "task: Clawdbot Legacy, run: C:\\clawdbot\\clawdbot.exe run",
        scope: "system",
        marker: "clawdbot",
        legacy: true,
      },
    ]);
  });

  it("reports duplicate root tasks that only share the gateway task prefix", async () => {
    execSchtasksMock.mockResolvedValueOnce({
      code: 0,
      stdout: [
        "TaskName:\\Quiet Core bot Gateway",
        "Task To Run: C:\\Program Files\\Quiet Core bot\\quiet-core-bot.exe gateway run",
        "",
        "TaskName:\\Quiet Core bot Gateway (dev)",
        "Task To Run: C:\\Program Files\\Quiet Core bot\\quiet-core-bot.exe gateway run --profile dev",
        "",
        "TaskName:\\Quiet Core bot Gateway Backup",
        "Task To Run: C:\\Program Files\\Quiet Core bot\\quiet-core-bot.exe gateway run",
        "",
      ].join("\n"),
      stderr: "",
    });

    const result = await findExtraGatewayServices({}, { deep: true });
    expect(result).toEqual([
      {
        platform: "win32",
        label: "\\Quiet Core bot Gateway Backup",
        detail:
          "task: \\Quiet Core bot Gateway Backup, run: C:\\Program Files\\Quiet Core bot\\quiet-core-bot.exe gateway run",
        scope: "system",
        marker: "quiet-core-bot",
        legacy: false,
      },
    ]);
  });
});
