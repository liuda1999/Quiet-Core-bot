// Tests Quiet Core bot home directory resolution.
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  expandHomePrefix,
  resolveEffectiveHomeDir,
  resolveHomeRelativePath,
  resolveOsHomeDir,
  resolveOsHomeRelativePath,
  resolveRequiredHomeDir,
} from "./home-dir.js";

describe("resolveEffectiveHomeDir", () => {
  it.each([
    {
      name: "prefers QUIET_CORE_HOME over HOME and USERPROFILE",
      env: {
        QUIET_CORE_HOME: " /srv/quiet-core-bot-home ",
        HOME: "/home/other",
        USERPROFILE: "C:/Users/other",
      } as NodeJS.ProcessEnv,
      homedir: () => "/fallback",
      expected: "/srv/quiet-core-bot-home",
    },
    {
      name: "falls back to HOME",
      env: { HOME: " /home/alice " } as NodeJS.ProcessEnv,
      expected: "/home/alice",
    },
    {
      name: "falls back to USERPROFILE when HOME is blank",
      env: {
        HOME: "   ",
        USERPROFILE: " C:/Users/alice ",
      } as NodeJS.ProcessEnv,
      expected: "C:/Users/alice",
    },
    {
      name: "falls back to homedir when env values are blank",
      env: {
        QUIET_CORE_HOME: " ",
        HOME: " ",
        USERPROFILE: "\t",
      } as NodeJS.ProcessEnv,
      homedir: () => " /fallback ",
      expected: "/fallback",
    },
    {
      name: "treats literal undefined env values as unset",
      env: {
        QUIET_CORE_HOME: "undefined",
        HOME: "undefined",
        USERPROFILE: "null",
      } as NodeJS.ProcessEnv,
      homedir: () => " /fallback ",
      expected: "/fallback",
    },
  ])("$name", ({ env, homedir, expected }) => {
    expect(resolveEffectiveHomeDir(env, homedir)).toBe(path.resolve(expected));
  });

  it.each([
    {
      name: "expands ~/ using HOME",
      env: {
        QUIET_CORE_HOME: "~/svc",
        HOME: "/home/alice",
      } as NodeJS.ProcessEnv,
      expected: "/home/alice/svc",
    },
    {
      name: "expands ~\\\\ using USERPROFILE",
      env: {
        QUIET_CORE_HOME: "~\\svc",
        HOME: " ",
        USERPROFILE: "C:/Users/alice",
      } as NodeJS.ProcessEnv,
      expected: "C:/Users/alice\\svc",
    },
  ])("$name", ({ env, expected }) => {
    expect(resolveEffectiveHomeDir(env)).toBe(path.resolve(expected));
  });

  it("derives home from PREFIX on Android/Termux when HOME is unset", () => {
    const env = {
      PREFIX: "/data/data/com.termux/files/usr",
      ANDROID_DATA: "/data",
    } as NodeJS.ProcessEnv;
    expect(resolveEffectiveHomeDir(env, () => "/home")).toBe(
      path.resolve("/data/data/com.termux/files/home"),
    );
  });

  it("prefers HOME over PREFIX-derived path on Termux", () => {
    const env = {
      HOME: "/data/data/com.termux/files/home",
      PREFIX: "/data/data/com.termux/files/usr",
      ANDROID_DATA: "/data",
    } as NodeJS.ProcessEnv;
    expect(resolveEffectiveHomeDir(env)).toBe(path.resolve("/data/data/com.termux/files/home"));
  });

  it("ignores PREFIX without com.termux to avoid false positives in generic chroots", () => {
    const env = {
      PREFIX: "/usr",
      ANDROID_DATA: "/data",
    } as NodeJS.ProcessEnv;
    expect(resolveEffectiveHomeDir(env, () => "/fallback")).toBe(path.resolve("/fallback"));
  });

  it("ignores PREFIX values that only mention com.termux outside the Termux app root", () => {
    const env = {
      PREFIX: "/tmp/com.termux/usr",
      ANDROID_DATA: "/data",
    } as NodeJS.ProcessEnv;
    expect(resolveEffectiveHomeDir(env, () => "/fallback")).toBe(path.resolve("/fallback"));
  });

  it("uses Termux PREFIX for tilde expansion when HOME is unset", () => {
    const env = {
      QUIET_CORE_HOME: "~/workspace",
      PREFIX: "/data/data/com.termux/files/usr",
      ANDROID_DATA: "/data",
    } as NodeJS.ProcessEnv;
    expect(
      resolveEffectiveHomeDir(env, () => {
        throw new Error("no homedir");
      }),
    ).toBe(path.resolve("/data/data/com.termux/files/home/workspace"));
  });

  it("expands QUIET_CORE_HOME when set to ~", () => {
    const env = {
      QUIET_CORE_HOME: "~/svc",
      HOME: "/home/alice",
    } as NodeJS.ProcessEnv;

    expect(resolveEffectiveHomeDir(env)).toBe(path.resolve("/home/alice/svc"));
  });
});

describe("resolveRequiredHomeDir", () => {
  it.each([
    {
      name: "returns cwd when no home source is available",
      env: {} as NodeJS.ProcessEnv,
      homedir: () => {
        throw new Error("no home");
      },
      expected: process.cwd(),
    },
    {
      name: "returns a fully resolved path for QUIET_CORE_HOME",
      env: { QUIET_CORE_HOME: "/custom/home" } as NodeJS.ProcessEnv,
      homedir: () => "/fallback",
      expected: path.resolve("/custom/home"),
    },
    {
      name: "returns cwd when QUIET_CORE_HOME is tilde-only and no fallback home exists",
      env: { QUIET_CORE_HOME: "~" } as NodeJS.ProcessEnv,
      homedir: () => {
        throw new Error("no home");
      },
      expected: process.cwd(),
    },
  ])("$name", ({ env, homedir, expected }) => {
    expect(resolveRequiredHomeDir(env, homedir)).toBe(expected);
  });
});

describe("resolveOsHomeDir", () => {
  it("ignores QUIET_CORE_HOME and uses HOME", () => {
    expect(
      resolveOsHomeDir(
        {
          QUIET_CORE_HOME: "/srv/quiet-core-bot-home",
          HOME: "/home/alice",
          USERPROFILE: "C:/Users/alice",
        } as NodeJS.ProcessEnv,
        () => "/fallback",
      ),
    ).toBe(path.resolve("/home/alice"));
  });
});

describe("expandHomePrefix", () => {
  it.each([
    {
      name: "expands ~/ using effective home",
      input: "~/x",
      opts: {
        env: { QUIET_CORE_HOME: "/srv/quiet-core-bot-home" } as NodeJS.ProcessEnv,
      },
      expected: `${path.resolve("/srv/quiet-core-bot-home")}/x`,
    },
    {
      name: "expands exact ~ using explicit home",
      input: "~",
      opts: { home: " /srv/quiet-core-bot-home " },
      expected: "/srv/quiet-core-bot-home",
    },
    {
      name: "expands ~\\\\ using resolved env home",
      input: "~\\x",
      opts: {
        env: { HOME: "/home/alice" } as NodeJS.ProcessEnv,
      },
      expected: `${path.resolve("/home/alice")}\\x`,
    },
    {
      name: "keeps non-tilde values unchanged",
      input: "/tmp/x",
      expected: "/tmp/x",
    },
  ])("$name", ({ input, opts, expected }) => {
    expect(expandHomePrefix(input, opts)).toBe(expected);
  });
});

describe("resolveHomeRelativePath", () => {
  it.each([
    {
      name: "returns blank input unchanged",
      input: "   ",
      expected: "",
    },
    {
      name: "resolves trimmed relative paths",
      input: " ./tmp/file.txt ",
      expected: path.resolve("./tmp/file.txt"),
    },
    {
      name: "resolves trimmed absolute paths",
      input: " /tmp/file.txt ",
      expected: path.resolve("/tmp/file.txt"),
    },
    {
      name: "expands tilde paths using the resolved home directory",
      input: "~/docs",
      opts: {
        env: { QUIET_CORE_HOME: "/srv/quiet-core-bot-home" } as NodeJS.ProcessEnv,
      },
      expected: path.resolve("/srv/quiet-core-bot-home/docs"),
    },
    {
      name: "falls back to cwd when tilde paths have no home source",
      input: "~",
      opts: {
        env: {} as NodeJS.ProcessEnv,
        homedir: () => {
          throw new Error("no home");
        },
      },
      expected: path.resolve(process.cwd()),
    },
  ])("$name", ({ input, opts, expected }) => {
    expect(resolveHomeRelativePath(input, opts)).toBe(expected);
  });
});

describe("resolveOsHomeRelativePath", () => {
  it("expands tilde paths using the OS home instead of QUIET_CORE_HOME", () => {
    expect(
      resolveOsHomeRelativePath("~/docs", {
        env: {
          QUIET_CORE_HOME: "/srv/quiet-core-bot-home",
          HOME: "/home/alice",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(path.resolve("/home/alice/docs"));
  });
});
