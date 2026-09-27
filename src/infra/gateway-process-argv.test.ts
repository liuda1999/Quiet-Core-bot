// Tests gateway process argv parsing for diagnostics.
import { describe, expect, it } from "vitest";
import { isGatewayArgv, parseProcCmdline } from "./gateway-process-argv.js";

describe("parseProcCmdline", () => {
  it("splits null-delimited argv and trims empty entries", () => {
    expect(parseProcCmdline(" node \0 gateway \0\0 --port \0 18789 \0")).toEqual([
      "node",
      "gateway",
      "--port",
      "18789",
    ]);
  });

  it("keeps non-delimited single arguments and drops whitespace-only entries", () => {
    expect(parseProcCmdline(" gateway ")).toEqual(["gateway"]);
    expect(parseProcCmdline(" \0\t\0 ")).toStrictEqual([]);
  });
});

describe("isGatewayArgv", () => {
  it("requires a gateway token", () => {
    expect(isGatewayArgv(["node", "dist/index.js", "--port", "18789"])).toBe(false);
  });

  it("matches known entrypoints across slash and case variants", () => {
    expect(isGatewayArgv(["NODE", "C:\\Quiet Core bot\\DIST\\ENTRY.JS", "gateway"])).toBe(true);
    expect(isGatewayArgv(["bun", "/srv/quiet-core-bot/scripts/run-node.mjs", "gateway"])).toBe(true);
    expect(isGatewayArgv(["node", "/srv/quiet-core-bot/quiet-core-bot.mjs", "gateway"])).toBe(true);
    expect(isGatewayArgv(["tsx", "/srv/quiet-core-bot/src/entry.ts", "gateway"])).toBe(true);
    expect(isGatewayArgv(["tsx", "/srv/quiet-core-bot/src/index.ts", "gateway"])).toBe(true);
  });

  it("matches the quiet-core-bot executable but gates the gateway binary behind the opt-in flag", () => {
    expect(isGatewayArgv(["C:\\bin\\quiet-core-bot.cmd", "gateway"])).toBe(true);
    expect(isGatewayArgv(["/usr/local/bin/quiet-core-bot-gateway", "gateway"])).toBe(false);
    expect(
      isGatewayArgv(["/usr/local/bin/quiet-core-bot-gateway", "gateway"], {
        allowGatewayBinary: true,
      }),
    ).toBe(true);
    expect(
      isGatewayArgv(["C:\\bin\\quiet-core-bot-gateway.EXE", "gateway"], {
        allowGatewayBinary: true,
      }),
    ).toBe(true);
  });

  it("rejects unknown gateway argv even when the token is present", () => {
    expect(isGatewayArgv(["node", "/srv/quiet-core-bot/custom.js", "gateway"])).toBe(false);
    expect(isGatewayArgv(["python", "gateway", "script.py"])).toBe(false);
  });
});
