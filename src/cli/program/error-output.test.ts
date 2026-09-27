// Error output tests cover program-level error display and exit messaging.
import { describe, expect, it } from "vitest";
import { formatCliParseErrorOutput } from "./error-output.js";

describe("formatCliParseErrorOutput", () => {
  it("explains unknown commands with root help and plugin hints", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'wat'\n", {
      argv: ["node", "quiet-core-bot", "wat"],
    });

    expect(output).toBe(
      'Quiet Core bot does not know the command "wat".\nTry: quiet-core-bot --help\nPlugin command? quiet-core-bot plugins list\nDocs: https://github.com/liuda1999/Quiet-Core-bot/cli\n',
    );
  });

  it("suggests close known commands for unknown commands", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'upate'\n", {
      argv: ["node", "quiet-core-bot", "upate"],
    });

    expect(output).toBe(
      'Quiet Core bot does not know the command "upate".\nDid you mean this?\n  quiet-core-bot update\nTry: quiet-core-bot --help\nPlugin command? quiet-core-bot plugins list\nDocs: https://github.com/liuda1999/Quiet-Core-bot/cli\n',
    );
  });

  it("suggests explicit aliases for common adjacent terminology", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'upgrade'\n", {
      argv: ["node", "quiet-core-bot", "upgrade"],
    });

    expect(output).toContain("Did you mean this?\n  quiet-core-bot update\n");
  });

  it("preserves active profile context in command suggestions", () => {
    const originalProfile = process.env.QUIET_CORE_PROFILE;
    process.env.QUIET_CORE_PROFILE = "work";
    try {
      const output = formatCliParseErrorOutput("error: unknown command 'doctr'\n", {
        argv: ["node", "quiet-core-bot", "doctr"],
      });

      expect(output).toContain("Did you mean this?\n  quiet-core-bot --profile work doctor\n");
    } finally {
      if (originalProfile === undefined) {
        delete process.env.QUIET_CORE_PROFILE;
      } else {
        process.env.QUIET_CORE_PROFILE = originalProfile;
      }
    }
  });

  it("points unknown options at the active command help", () => {
    const output = formatCliParseErrorOutput("error: unknown option '--wat'\n", {
      argv: ["node", "quiet-core-bot", "channels", "status", "--wat"],
    });

    expect(output).toBe(
      'Quiet Core bot does not recognize option "--wat".\nTry: quiet-core-bot channels status --help\n',
    );
  });

  it("points missing required arguments at command help", () => {
    const output = formatCliParseErrorOutput("error: missing required argument 'name'\n", {
      argv: ["node", "quiet-core-bot", "plugins", "install"],
    });

    expect(output).toBe(
      'Missing required argument "name".\nTry: quiet-core-bot plugins install --help\n',
    );
  });
});
