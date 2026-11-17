// Error translation tests: kit codes survive into the core tool error string.
import { describe, expect, it } from "vitest";
import { translateWebToolError } from "./adapter.js";
import { WebError } from "./types.js";

describe("translateWebToolError", () => {
  it("prefixes kit codes for model-visible errors", () => {
    const error = new WebError(
      "URL hostname resolves to a non-public IP address",
      "WEB_BLOCKED_URL",
    );
    const translated = translateWebToolError("web_fetch", error);
    expect(translated.message).toBe(
      "web_fetch failed [WEB_BLOCKED_URL]: URL hostname resolves to a non-public IP address",
    );
    expect(translated.cause).toBe(error);
  });

  it("rethrows the caller's abort reason unchanged", () => {
    const controller = new AbortController();
    const reason = new Error("user cancelled");
    controller.abort(reason);
    expect(translateWebToolError("web_search", new Error("ignored"), controller.signal)).toBe(
      reason,
    );
  });

  it("passes plain errors through", () => {
    const error = new Error("socket hang up");
    expect(translateWebToolError("web_fetch", error)).toBe(error);
  });

  it("wraps non-error values", () => {
    expect(translateWebToolError("web_fetch", "boom").message).toBe("boom");
  });
});
