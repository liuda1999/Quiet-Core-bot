// web_fetch adapter tests: argument handling, truncation, and error surfacing.
import { describe, expect, it, vi } from "vitest";
import { WebError } from "../../web-tools/types.js";

const state = vi.hoisted(() => ({
  handler: null as null | ((request: { url: string }) => Promise<unknown>),
}));

vi.mock("../../web-tools/kit-singleton.js", () => ({
  getWebKit: () => ({
    web: {
      fetch: (request: { url: string }) => {
        if (state.handler === null) {
          throw new Error("test handler not configured");
        }
        return state.handler(request);
      },
    },
  }),
  disposeWebKit: async () => undefined,
}));

import { createWebFetchTool } from "./web-fetch.js";

function toolOrThrow() {
  const tool = createWebFetchTool({ config: {}, sandboxed: false });
  if (tool === null) {
    throw new Error("web_fetch was unexpectedly disabled");
  }
  return tool;
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content;
  return content?.[0]?.text ?? "";
}

describe("createWebFetchTool", () => {
  it("returns formatted content", async () => {
    state.handler = async (request) => ({
      url: request.url,
      statusCode: 200,
      body: { kind: "text", content: "hello world" },
      truncated: false,
    });
    const result = await toolOrThrow().execute("call-1", { url: "https://example.com" });
    expect(textOf(result)).toContain("hello world");
    expect(textOf(result)).toContain("untrusted");
  });

  it("truncates to the per-call maxChars", async () => {
    state.handler = async (request) => ({
      url: request.url,
      statusCode: 200,
      body: { kind: "text", content: "x".repeat(5_000) },
      truncated: false,
    });
    const result = await toolOrThrow().execute("call-2", {
      url: "https://example.com",
      maxChars: 200,
    });
    expect(textOf(result).length).toBeLessThan(1_000);
  });

  it("rejects an empty url with a routable code", async () => {
    await expect(toolOrThrow().execute("call-3", { url: "  " })).rejects.toThrow(
      "web_fetch failed [WEB_INVALID_ARGS]",
    );
  });

  it("surfaces kit error codes", async () => {
    state.handler = async () => {
      throw new WebError("URL hostname resolves to a non-public IP address", "WEB_BLOCKED_URL");
    };
    await expect(
      toolOrThrow().execute("call-4", { url: "https://internal.example" }),
    ).rejects.toThrow("web_fetch failed [WEB_BLOCKED_URL]");
  });

  it("disables web_fetch when explicitly configured", () => {
    expect(
      createWebFetchTool({ config: { tools: { web: { fetch: { enabled: false } } } } }),
    ).toBeNull();
  });
});
