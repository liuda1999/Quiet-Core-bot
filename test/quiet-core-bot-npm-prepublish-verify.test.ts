import { describe, expect, it } from "vitest";
import {
  openClawNpmPrepublishVerifyUsage,
  parseQuietCoreNpmPrepublishVerifyArgs,
} from "../scripts/quiet-core-bot-npm-prepublish-verify.ts";

describe("parseQuietCoreNpmPrepublishVerifyArgs", () => {
  it("supports help, optional versions, and package-manager separators", () => {
    expect(parseQuietCoreNpmPrepublishVerifyArgs(["--help"])).toEqual({
      help: true,
      tarballPath: "",
    });
    expect(parseQuietCoreNpmPrepublishVerifyArgs(["quiet-core-bot.tgz"])).toEqual({
      help: false,
      tarballPath: "quiet-core-bot.tgz",
    });
    expect(parseQuietCoreNpmPrepublishVerifyArgs(["--", "quiet-core-bot.tgz", "2026.3.23"])).toEqual({
      expectedVersion: "2026.3.23",
      help: false,
      tarballPath: "quiet-core-bot.tgz",
    });
  });

  it("rejects missing, option-like, and extra arguments before installing", () => {
    expect(() => parseQuietCoreNpmPrepublishVerifyArgs([])).toThrow(
      openClawNpmPrepublishVerifyUsage(),
    );
    expect(() => parseQuietCoreNpmPrepublishVerifyArgs(["--tag"])).toThrow(
      "Unknown quiet-core-bot npm prepublish verifier option: --tag",
    );
    expect(() => parseQuietCoreNpmPrepublishVerifyArgs(["quiet-core-bot.tgz", "--tag"])).toThrow(
      "Unknown quiet-core-bot npm prepublish verifier option: --tag",
    );
    expect(() =>
      parseQuietCoreNpmPrepublishVerifyArgs(["quiet-core-bot.tgz", "2026.3.23", "extra"]),
    ).toThrow("Unexpected quiet-core-bot npm prepublish verifier argument: extra");
  });
});
