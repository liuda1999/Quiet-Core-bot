// Entry metadata tests cover display metadata resolution for agents and jobs.
import { describe, expect, it } from "vitest";
import { resolveEmojiAndHomepage } from "./entry-metadata.js";

describe("shared/entry-metadata", () => {
  it("prefers metadata emoji and homepage when present", () => {
    expect(
      resolveEmojiAndHomepage({
        metadata: { emoji: "🦀", homepage: " https://github.com/liuda1999/Quiet-Core-bot " },
        frontmatter: { emoji: "🙂", homepage: "https://example.com" },
      }),
    ).toEqual({
      emoji: "🦀",
      homepage: "https://github.com/liuda1999/Quiet-Core-bot",
    });
  });

  it("keeps metadata precedence even when metadata values are blank", () => {
    expect(
      resolveEmojiAndHomepage({
        metadata: { emoji: "", homepage: "   " },
        frontmatter: { emoji: "🙂", homepage: "https://example.com" },
      }),
    ).toStrictEqual({});
  });

  it("falls back through frontmatter homepage aliases and drops blanks", () => {
    expect(
      resolveEmojiAndHomepage({
        frontmatter: { emoji: "🙂", website: " https://github.com/liuda1999/Quiet-Core-bot " },
      }),
    ).toEqual({
      emoji: "🙂",
      homepage: "https://github.com/liuda1999/Quiet-Core-bot",
    });
    expect(
      resolveEmojiAndHomepage({
        metadata: { homepage: "   " },
        frontmatter: { url: "   " },
      }),
    ).toStrictEqual({});
    expect(
      resolveEmojiAndHomepage({
        frontmatter: { url: " https://github.com/liuda1999/Quiet-Core-bot " },
      }),
    ).toEqual({
      homepage: "https://github.com/liuda1999/Quiet-Core-bot",
    });
  });

  it("does not fall back once frontmatter homepage aliases are present but blank", () => {
    expect(
      resolveEmojiAndHomepage({
        frontmatter: {
          homepage: " ",
          website: "https://github.com/liuda1999/Quiet-Core-bot",
          url: "https://github.com/liuda1999/Quiet-Core-bot",
        },
      }),
    ).toStrictEqual({});
  });
});
