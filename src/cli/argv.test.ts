// Argv tests cover CLI argument parsing helpers and platform-specific normalization.
import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPositionalsWithRootOptions,
  getCommandPathWithRootOptions,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  isHelpOrVersionInvocation,
  isRootHelpInvocation,
  isRootVersionInvocation,
  normalizeGeneratedHelpCommandArgv,
  normalizeRootHelpTargetArgv,
  normalizeRootLogLevelArgv,
  normalizeRootNoColorArgv,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "quiet-core-bot", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "quiet-core-bot", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "quiet-core-bot", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "quiet-core-bot", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "quiet-core-bot", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "quiet-core-bot", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "quiet-core-bot", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "quiet-core-bot", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "quiet-core-bot", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "known command group help command help flag",
      argv: ["node", "quiet-core-bot", "backup", "help", "--help"],
      expected: ["node", "quiet-core-bot", "backup", "help"],
    },
    {
      name: "known command group help command short help flag",
      argv: ["node", "quiet-core-bot", "--profile", "work", "backup", "help", "-h"],
      expected: ["node", "quiet-core-bot", "--profile", "work", "backup", "help"],
    },
    {
      name: "leaf positional help remains untouched",
      argv: ["node", "quiet-core-bot", "docs", "help", "--help"],
      expected: ["node", "quiet-core-bot", "docs", "help", "--help"],
    },
    {
      name: "known command group help target",
      argv: ["node", "quiet-core-bot", "plugins", "help", "list"],
      expected: ["node", "quiet-core-bot", "plugins", "list", "--help"],
    },
    {
      name: "known command group help target help flag",
      argv: ["node", "quiet-core-bot", "plugins", "help", "list", "--help"],
      expected: ["node", "quiet-core-bot", "plugins", "list", "--help"],
    },
    {
      name: "unknown plugin command group help target",
      argv: ["node", "quiet-core-bot", "external-plugin", "help", "inspect"],
      expected: ["node", "quiet-core-bot", "external-plugin", "inspect", "--help"],
    },
    {
      name: "unknown plugin command group help target help flag",
      argv: ["node", "quiet-core-bot", "external-plugin", "help", "inspect", "--help"],
      expected: ["node", "quiet-core-bot", "external-plugin", "inspect", "--help"],
    },
    {
      name: "generated help target with trailing root option",
      argv: ["node", "quiet-core-bot", "memory", "help", "status", "--no-color"],
      expected: ["node", "quiet-core-bot", "--no-color", "memory", "status", "--help"],
    },
    {
      name: "extra help positionals remain untouched",
      argv: ["node", "quiet-core-bot", "backup", "help", "missing", "extra", "--help"],
      expected: ["node", "quiet-core-bot", "backup", "help", "missing", "extra", "--help"],
    },
    {
      name: "terminator help flag remains untouched",
      argv: ["node", "quiet-core-bot", "backup", "help", "--", "--help"],
      expected: ["node", "quiet-core-bot", "backup", "help", "--", "--help"],
    },
  ])("normalizes generated help commands: $name", ({ argv, expected }) => {
    expect(normalizeGeneratedHelpCommandArgv(argv)).toEqual(expected);
  });

  it.each([
    {
      name: "root help target",
      argv: ["node", "quiet-core-bot", "help", "plugins"],
      expected: ["node", "quiet-core-bot", "plugins", "--help"],
    },
    {
      name: "root help target with help flag",
      argv: ["node", "quiet-core-bot", "help", "plugins", "--help"],
      expected: ["node", "quiet-core-bot", "plugins", "--help"],
    },
    {
      name: "root option before help target",
      argv: ["node", "quiet-core-bot", "--profile", "work", "help", "memory"],
      expected: ["node", "quiet-core-bot", "--profile", "work", "memory", "--help"],
    },
    {
      name: "bare root help remains untouched",
      argv: ["node", "quiet-core-bot", "help"],
      expected: ["node", "quiet-core-bot", "help"],
    },
    {
      name: "root help self-help remains untouched",
      argv: ["node", "quiet-core-bot", "help", "--help"],
      expected: ["node", "quiet-core-bot", "help", "--help"],
    },
    {
      name: "nested root help target",
      argv: ["node", "quiet-core-bot", "help", "plugins", "list"],
      expected: ["node", "quiet-core-bot", "plugins", "list", "--help"],
    },
    {
      name: "nested root help target with help flag",
      argv: ["node", "quiet-core-bot", "help", "plugins", "list", "--help"],
      expected: ["node", "quiet-core-bot", "plugins", "list", "--help"],
    },
    {
      name: "nested root help target with trailing root option",
      argv: ["node", "quiet-core-bot", "help", "memory", "status", "--no-color"],
      expected: ["node", "quiet-core-bot", "--no-color", "memory", "status", "--help"],
    },
  ])("normalizes root help targets: $name", ({ argv, expected }) => {
    expect(normalizeRootHelpTargetArgv(argv)).toEqual(expected);
  });

  it.each([
    {
      name: "subcommand trailing no-color",
      argv: ["node", "quiet-core-bot", "doctor", "--no-color", "--post-upgrade", "--json"],
      expected: ["node", "quiet-core-bot", "--no-color", "doctor", "--post-upgrade", "--json"],
    },
    {
      name: "keeps existing root options first",
      argv: [
        "node",
        "quiet-core-bot",
        "--profile",
        "work",
        "doctor",
        "--no-color",
        "--lint",
        "--json",
      ],
      expected: [
        "node",
        "quiet-core-bot",
        "--profile",
        "work",
        "--no-color",
        "doctor",
        "--lint",
        "--json",
      ],
    },
    {
      name: "keeps no-color after possible command option value",
      argv: ["node", "quiet-core-bot", "doctor", "--lint", "--json", "--no-color"],
      expected: ["node", "quiet-core-bot", "doctor", "--lint", "--json", "--no-color"],
    },
    {
      name: "flag terminator leaves no-color positional",
      argv: ["node", "quiet-core-bot", "doctor", "--", "--no-color"],
      expected: ["node", "quiet-core-bot", "doctor", "--", "--no-color"],
    },
    {
      name: "command option value remains literal",
      argv: ["node", "quiet-core-bot", "agent", "--message", "--no-color"],
      expected: ["node", "quiet-core-bot", "agent", "--message", "--no-color"],
    },
    {
      name: "assigned command option value does not block no-color",
      argv: ["node", "quiet-core-bot", "agent", "--message=hello", "--no-color"],
      expected: ["node", "quiet-core-bot", "--no-color", "agent", "--message=hello"],
    },
  ])("normalizes root --no-color before command parsing: $name", ({ argv, expected }) => {
    expect(normalizeRootNoColorArgv(argv)).toEqual(expected);
  });

  it("allows final command metadata to lift no-color after boolean command flags", () => {
    const argv = ["node", "quiet-core-bot", "doctor", "--lint", "--json", "--no-color"];

    expect(
      normalizeRootNoColorArgv(argv, {
        shouldPreserveNoColor: ({ remainingArgs, noColorIndex }) =>
          remainingArgs[noColorIndex - 1] === "--message",
      }),
    ).toEqual(["node", "quiet-core-bot", "--no-color", "doctor", "--lint", "--json"]);
  });

  it.each([
    {
      name: "subcommand trailing log-level",
      argv: ["node", "quiet-core-bot", "doctor", "--log-level", "debug", "--json"],
      expected: ["node", "quiet-core-bot", "--log-level", "debug", "doctor", "--json"],
    },
    {
      name: "subcommand trailing log-level equals form",
      argv: ["node", "quiet-core-bot", "doctor", "--log-level=trace", "--json"],
      expected: ["node", "quiet-core-bot", "--log-level=trace", "doctor", "--json"],
    },
    {
      name: "keeps existing root options first",
      argv: ["node", "quiet-core-bot", "--profile", "work", "doctor", "--log-level", "debug"],
      expected: ["node", "quiet-core-bot", "--profile", "work", "--log-level", "debug", "doctor"],
    },
    {
      name: "keeps log-level after possible command option value",
      argv: ["node", "quiet-core-bot", "agent", "--message", "--log-level", "debug"],
      expected: ["node", "quiet-core-bot", "agent", "--message", "--log-level", "debug"],
    },
    {
      name: "flag terminator leaves log-level positional",
      argv: ["node", "quiet-core-bot", "nodes", "run", "--", "--log-level", "debug"],
      expected: ["node", "quiet-core-bot", "nodes", "run", "--", "--log-level", "debug"],
    },
    {
      name: "missing value remains command scoped",
      argv: ["node", "quiet-core-bot", "doctor", "--log-level", "--json"],
      expected: ["node", "quiet-core-bot", "doctor", "--log-level", "--json"],
    },
  ])("normalizes root --log-level before command parsing: $name", ({ argv, expected }) => {
    expect(normalizeRootLogLevelArgv(argv)).toEqual(expected);
  });

  it("allows final command metadata to lift log-level after boolean command flags", () => {
    const argv = ["node", "quiet-core-bot", "doctor", "--lint", "--json", "--log-level", "debug"];

    expect(
      normalizeRootLogLevelArgv(argv, {
        shouldPreserveLogLevel: ({ remainingArgs, logLevelIndex }) =>
          remainingArgs[logLevelIndex - 1] === "--message",
      }),
    ).toEqual(["node", "quiet-core-bot", "--log-level", "debug", "doctor", "--lint", "--json"]);
  });

  it("preserves log-level when final command metadata owns the option", () => {
    const argv = ["node", "quiet-core-bot", "plugin-cmd", "--log-level", "debug"];

    expect(
      normalizeRootLogLevelArgv(argv, {
        shouldPreserveLogLevel: ({ remainingArgs, logLevelIndex }) =>
          remainingArgs[logLevelIndex] === "--log-level",
      }),
    ).toEqual(argv);
  });

  it.each([
    {
      name: "root help command",
      argv: ["node", "quiet-core-bot", "help"],
      expected: true,
    },
    {
      name: "root help command with target",
      argv: ["node", "quiet-core-bot", "help", "matrix"],
      expected: true,
    },
    {
      name: "nested help command",
      argv: ["node", "quiet-core-bot", "matrix", "encryption", "help"],
      expected: true,
    },
    {
      name: "known subcommand root help command",
      argv: ["node", "quiet-core-bot", "config", "help"],
      expected: true,
    },
    {
      name: "known leaf command positional help",
      argv: ["node", "quiet-core-bot", "docs", "help"],
      expected: false,
    },
    {
      name: "known subcommand leaf positional help",
      argv: ["node", "quiet-core-bot", "config", "set", "some.path", "help"],
      expected: false,
    },
    {
      name: "unknown plugin command help",
      argv: ["node", "quiet-core-bot", "external-plugin", "tools", "help"],
      expected: true,
    },
    {
      name: "help flag",
      argv: ["node", "quiet-core-bot", "matrix", "encryption", "--help"],
      expected: true,
    },
    {
      name: "help as option value",
      argv: ["node", "quiet-core-bot", "agent", "--message", "help"],
      expected: false,
    },
    {
      name: "help after terminator",
      argv: ["node", "quiet-core-bot", "nodes", "invoke", "--", "help"],
      expected: false,
    },
    {
      name: "help flag after terminator",
      argv: ["node", "quiet-core-bot", "nodes", "invoke", "--", "--help"],
      expected: false,
    },
    {
      name: "version flag after terminator",
      argv: ["node", "quiet-core-bot", "nodes", "invoke", "--", "--version"],
      expected: false,
    },
  ])("detects help/version invocations: $name", ({ argv, expected }) => {
    expect(isHelpOrVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --version",
      argv: ["node", "quiet-core-bot", "--version"],
      expected: true,
    },
    {
      name: "root -V",
      argv: ["node", "quiet-core-bot", "-V"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "quiet-core-bot", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "subcommand version flag",
      argv: ["node", "quiet-core-bot", "status", "--version"],
      expected: false,
    },
    {
      name: "unknown root flag with version",
      argv: ["node", "quiet-core-bot", "--unknown", "--version"],
      expected: false,
    },
  ])("detects root-only version invocations: $name", ({ argv, expected }) => {
    expect(isRootVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --help",
      argv: ["node", "quiet-core-bot", "--help"],
      expected: true,
    },
    {
      name: "root -h",
      argv: ["node", "quiet-core-bot", "-h"],
      expected: true,
    },
    {
      name: "root --help with profile",
      argv: ["node", "quiet-core-bot", "--profile", "work", "--help"],
      expected: true,
    },
    {
      name: "subcommand --help",
      argv: ["node", "quiet-core-bot", "status", "--help"],
      expected: false,
    },
    {
      name: "help before subcommand token",
      argv: ["node", "quiet-core-bot", "--help", "status"],
      expected: false,
    },
    {
      name: "help after -- terminator",
      argv: ["node", "quiet-core-bot", "nodes", "invoke", "--", "device.status", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag before help",
      argv: ["node", "quiet-core-bot", "--unknown", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag after help",
      argv: ["node", "quiet-core-bot", "--help", "--unknown"],
      expected: false,
    },
  ])("detects root-only help invocations: $name", ({ argv, expected }) => {
    expect(isRootHelpInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "quiet-core-bot", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "quiet-core-bot", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "quiet-core-bot", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPathWithRootOptions(argv, 2)).toEqual(expected);
  });

  it("extracts command path while skipping known root option values", () => {
    expect(
      getCommandPathWithRootOptions(
        [
          "node",
          "quiet-core-bot",
          "--profile",
          "work",
          "--container",
          "demo",
          "--no-color",
          "config",
          "validate",
        ],
        2,
      ),
    ).toEqual(["config", "validate"]);
  });

  it("extracts routed config get positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        [
          "node",
          "quiet-core-bot",
          "config",
          "get",
          "--log-level",
          "debug",
          "update.channel",
          "--json",
        ],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("extracts routed config unset positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "quiet-core-bot", "config", "unset", "--profile", "work", "update.channel"],
        {
          commandPath: ["config", "unset"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("returns null when routed command sees unknown options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "quiet-core-bot", "config", "get", "--mystery", "value", "update.channel"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toBeNull();
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "quiet-core-bot", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "quiet-core-bot"],
      expected: null,
    },
    {
      name: "skips known root option values",
      argv: ["node", "quiet-core-bot", "--log-level", "debug", "status"],
      expected: "status",
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "quiet-core-bot", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "quiet-core-bot", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "quiet-core-bot", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "quiet-core-bot", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "quiet-core-bot", "--", "--timeout=99"],
      expected: undefined,
    },
    {
      name: "repeated flag uses final value",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "100", "--timeout=200"],
      expected: "200",
    },
    {
      name: "missing repeated value remains invalid",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "--timeout", "200"],
      expected: null,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "quiet-core-bot", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "quiet-core-bot", "status", "--debug"])).toBe(false);
    expect(
      getVerboseFlag(["node", "quiet-core-bot", "status", "--debug"], { includeDebug: true }),
    ).toBe(true);
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "quiet-core-bot", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "quiet-core-bot", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "valid signed decimal positive integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "+5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "nope"],
      expected: null,
    },
    {
      name: "non-decimal integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "0x10"],
      expected: null,
    },
    {
      name: "partial integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "5s"],
      expected: null,
    },
    {
      name: "zero",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "0"],
      expected: null,
    },
    {
      name: "negative integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "-5"],
      expected: null,
    },
    {
      name: "repeated value uses final valid integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "nope", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "repeated value rejects final invalid integer",
      argv: ["node", "quiet-core-bot", "status", "--timeout", "5000", "--timeout", "nope"],
      expected: null,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it.each([
    {
      name: "keeps plain node argv",
      rawArgs: ["node", "quiet-core-bot", "status"],
      expected: ["node", "quiet-core-bot", "status"],
    },
    {
      name: "keeps version-suffixed node binary",
      rawArgs: ["node-22", "quiet-core-bot", "status"],
      expected: ["node-22", "quiet-core-bot", "status"],
    },
    {
      name: "keeps windows versioned node exe",
      rawArgs: ["node-22.2.0.exe", "quiet-core-bot", "status"],
      expected: ["node-22.2.0.exe", "quiet-core-bot", "status"],
    },
    {
      name: "keeps dotted node binary",
      rawArgs: ["node-22.2", "quiet-core-bot", "status"],
      expected: ["node-22.2", "quiet-core-bot", "status"],
    },
    {
      name: "keeps dotted node exe",
      rawArgs: ["node-22.2.exe", "quiet-core-bot", "status"],
      expected: ["node-22.2.exe", "quiet-core-bot", "status"],
    },
    {
      name: "keeps absolute versioned node path",
      rawArgs: ["/usr/bin/node-22.2.0", "quiet-core-bot", "status"],
      expected: ["/usr/bin/node-22.2.0", "quiet-core-bot", "status"],
    },
    {
      name: "keeps node24 shorthand",
      rawArgs: ["node24", "quiet-core-bot", "status"],
      expected: ["node24", "quiet-core-bot", "status"],
    },
    {
      name: "keeps absolute node24 shorthand",
      rawArgs: ["/usr/bin/node24", "quiet-core-bot", "status"],
      expected: ["/usr/bin/node24", "quiet-core-bot", "status"],
    },
    {
      name: "keeps windows node24 exe",
      rawArgs: ["node24.exe", "quiet-core-bot", "status"],
      expected: ["node24.exe", "quiet-core-bot", "status"],
    },
    {
      name: "keeps nodejs binary",
      rawArgs: ["nodejs", "quiet-core-bot", "status"],
      expected: ["nodejs", "quiet-core-bot", "status"],
    },
    {
      name: "prefixes fallback when first arg is not a node launcher",
      rawArgs: ["node-dev", "quiet-core-bot", "status"],
      expected: ["node", "quiet-core-bot", "node-dev", "quiet-core-bot", "status"],
    },
    {
      name: "prefixes fallback when raw args start at program name",
      rawArgs: ["quiet-core-bot", "status"],
      expected: ["node", "quiet-core-bot", "status"],
    },
    {
      name: "keeps bun execution argv",
      rawArgs: ["bun", "src/entry.ts", "status"],
      expected: ["bun", "src/entry.ts", "status"],
    },
  ] as const)("builds parse argv from raw args: $name", ({ rawArgs, expected }) => {
    const parsed = buildParseArgv({
      programName: "quiet-core-bot",
      rawArgs: [...rawArgs],
    });
    expect(parsed).toEqual([...expected]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "quiet-core-bot",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "quiet-core-bot", "status"]);
  });

  it.each([
    { argv: ["node", "quiet-core-bot", "status"], expected: false },
    { argv: ["node", "quiet-core-bot", "health"], expected: false },
    { argv: ["node", "quiet-core-bot", "sessions"], expected: false },
    { argv: ["node", "quiet-core-bot", "--profile", "work", "status"], expected: false },
    { argv: ["node", "quiet-core-bot", "--log-level=debug", "models", "list"], expected: false },
    { argv: ["node", "quiet-core-bot", "config", "get", "update"], expected: false },
    { argv: ["node", "quiet-core-bot", "config", "unset", "update"], expected: false },
    { argv: ["node", "quiet-core-bot", "models", "list"], expected: false },
    { argv: ["node", "quiet-core-bot", "models", "status"], expected: false },
    { argv: ["node", "quiet-core-bot", "update", "status", "--json"], expected: false },
    { argv: ["node", "quiet-core-bot", "agent", "--message", "hi"], expected: true },
    { argv: ["node", "quiet-core-bot", "agents", "list"], expected: false },
    { argv: ["node", "quiet-core-bot", "plugins", "list"], expected: false },
    { argv: ["node", "quiet-core-bot", "skills", "list"], expected: false },
    { argv: ["node", "quiet-core-bot", "message", "send"], expected: true },
  ] as const)("decides when to migrate state: $argv", ({ argv, expected }) => {
    const commandPath = getCommandPathWithRootOptions([...argv], 2);
    expect(shouldMigrateStateFromPath(commandPath)).toBe(expected);
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["update", "status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["agent"], expected: true },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: false },
    { path: ["plugins", "list"], expected: false },
    { path: [], expected: false },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
