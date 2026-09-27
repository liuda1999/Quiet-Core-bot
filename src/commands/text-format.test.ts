// Text format tests cover command-facing shortening helpers.
import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("quiet-core-bot", 16)).toBe("quiet-core-bot");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("quiet-core-bot-status-output", 10)).toBe("quiet-core-bot-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
