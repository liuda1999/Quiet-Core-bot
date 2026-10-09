// Terminal Core tests cover links behavior.
import { describe, expect, it } from "vitest";
import { formatDocsLink } from "./links.js";

describe("formatDocsLink", () => {
  it("prepends the docs root when given a relative path", () => {
    const out = formatDocsLink("/channels/quietchat", "quietchat");
    expect(out).toBe(
      "https://github.com/liuda1999/Quiet-Core-bot/blob/main/docs/channels/quietchat.md",
    );
  });

  it("preserves an absolute http url", () => {
    const out = formatDocsLink("https://example.com/page", "page");
    expect(out).toBe("https://example.com/page");
  });

  it("preserves an anchor when mapping to the Markdown source path", () => {
    const out = formatDocsLink("/plugins/community#wecom");
    expect(out).toBe(
      "https://github.com/liuda1999/Quiet-Core-bot/blob/main/docs/plugins/community.md#wecom",
    );
  });

  it("does not double-append a Markdown extension", () => {
    const out = formatDocsLink("/tools/web.md");
    expect(out).toBe("https://github.com/liuda1999/Quiet-Core-bot/blob/main/docs/tools/web.md");
  });

  it("treats whitespace-only path like an empty path and falls back to docs root", () => {
    const out = formatDocsLink("   ", "root");
    expect(out).toBe("https://github.com/liuda1999/Quiet-Core-bot/tree/main/docs");
  });

  it("maps the bare docs route to the docs root", () => {
    const out = formatDocsLink("/", "root");
    expect(out).toBe("https://github.com/liuda1999/Quiet-Core-bot/tree/main/docs");
  });

  it("falls back to docs root when path is undefined (regression: #67076, #67074)", () => {
    const out = formatDocsLink(undefined as unknown as string, "label");
    expect(out).toBe("https://github.com/liuda1999/Quiet-Core-bot/tree/main/docs");
  });

  it("falls back to docs root when path is null", () => {
    const out = formatDocsLink(null as unknown as string);
    expect(out).toBe("https://github.com/liuda1999/Quiet-Core-bot/tree/main/docs");
  });
});
