import { describe, expect, it } from "vitest";
import {
  openClawNpmPrepublishVerifyUsage,
  parseOpenClawNpmPrepublishVerifyArgs,
} from "../scripts/quiet-core-bot-npm-prepublish-verify.ts";

describe("parseOpenClawNpmPrepublishVerifyArgs", () => {
  it("supports help, optional versions, and package-manager separators", () => {
    expect(parseOpenClawNpmPrepublishVerifyArgs(["--help"])).toEqual({
      help: true,
      tarballPath: "",
    });
    expect(parseOpenClawNpmPrepublishVerifyArgs(["quiet-core-bot.tgz"])).toEqual({
      help: false,
      tarballPath: "quiet-core-bot.tgz",
    });
    expect(parseOpenClawNpmPrepublishVerifyArgs(["--", "quiet-core-bot.tgz", "2026.3.23"])).toEqual({
      expectedVersion: "2026.3.23",
      help: false,
      tarballPath: "quiet-core-bot.tgz",
    });
  });

  it("rejects missing, option-like, and extra arguments before installing", () => {
    expect(() => parseOpenClawNpmPrepublishVerifyArgs([])).toThrow(
      openClawNpmPrepublishVerifyUsage(),
    );
    expect(() => parseOpenClawNpmPrepublishVerifyArgs(["--tag"])).toThrow(
      "Unknown quiet-core-bot npm prepublish verifier option: --tag",
    );
    expect(() => parseOpenClawNpmPrepublishVerifyArgs(["quiet-core-bot.tgz", "--tag"])).toThrow(
      "Unknown quiet-core-bot npm prepublish verifier option: --tag",
    );
    expect(() =>
      parseOpenClawNpmPrepublishVerifyArgs(["quiet-core-bot.tgz", "2026.3.23", "extra"]),
    ).toThrow("Unexpected quiet-core-bot npm prepublish verifier argument: extra");
  });
});
