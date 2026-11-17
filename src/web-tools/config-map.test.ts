// Config mapping tests: core `tools.web.*` fields onto dsh-web-kit options.
import { describe, expect, it } from "vitest";
import { DEFAULT_CORE_FETCH_MAX_CHARS, resolveWebToolsOptions } from "./adapter.js";

type Resolved = ReturnType<typeof resolveWebToolsOptions>;

function searchKind(resolved: Resolved): string | undefined {
  const search = resolved.options.search;
  return search === false || search === undefined ? undefined : search.kind;
}

describe("resolveWebToolsOptions", () => {
  it("uses keyless defaults with a 20k fetch cap", () => {
    const resolved = resolveWebToolsOptions({ config: {} });
    expect(searchKind(resolved)).toBe("http-first");
    expect(resolved.options.render).toEqual({ minTextChars: 100 });
    expect(resolved.searchMaxResults).toBe(8);
    expect(resolved.fetchMaxOutputChars).toBe(DEFAULT_CORE_FETCH_MAX_CHARS);
    expect(resolved.options.fetchOptions?.useEnvProxy).toBe(false);
    expect(resolved.options.fetchOptions?.ssrfOverrides).toEqual({
      allowRfc2544BenchmarkRange: false,
      allowIpv6UniqueLocalRange: false,
    });
  });

  it("clamps maxResults and maxChars to their caps", () => {
    const resolved = resolveWebToolsOptions({
      config: {
        tools: {
          web: {
            search: { maxResults: 99 },
            fetch: { maxChars: 9_999_999, maxCharsCap: 5_000 },
          },
        },
      },
    });
    expect(resolved.searchMaxResults).toBe(10);
    expect(resolved.fetchMaxOutputChars).toBe(5_000);
  });

  it("maps search provider ids and fetch limits", () => {
    const resolved = resolveWebToolsOptions({
      config: {
        tools: {
          web: {
            search: { provider: "searxng", timeoutSeconds: 7 },
            fetch: {
              maxResponseBytes: 123_456,
              timeoutSeconds: 9,
              maxRedirects: 2,
              userAgent: "test-agent",
              useTrustedEnvProxy: true,
            },
          },
        },
      },
    });
    expect(searchKind(resolved)).toBe("searxng");
    expect(resolved.options.fetch).toMatchObject({
      maxResponseBytes: 123_456,
      timeoutMs: 9_000,
      maxRedirects: 2,
      userAgent: "test-agent",
    });
    expect(resolved.options.fetchOptions?.useEnvProxy).toBe(true);
  });

  it("forces HTTP-only search and disables rendering in a sandbox", () => {
    const resolved = resolveWebToolsOptions({
      config: { tools: { web: { search: { provider: "browser" } } } },
      sandboxed: true,
    });
    expect(resolved.options.render).toBe(false);
    expect(resolved.options.search).toMatchObject({ kind: "bing-html" });
  });

  it("maps ssrfPolicy opt-outs", () => {
    const resolved = resolveWebToolsOptions({
      config: {
        tools: {
          web: {
            fetch: {
              ssrfPolicy: {
                allowRfc2544BenchmarkRange: true,
                allowIpv6UniqueLocalRange: true,
              },
            },
          },
        },
      },
    });
    expect(resolved.options.fetchOptions?.ssrfOverrides).toEqual({
      allowRfc2544BenchmarkRange: true,
      allowIpv6UniqueLocalRange: true,
    });
  });

  it("falls back to the keyless backend for unknown provider ids", () => {
    const resolved = resolveWebToolsOptions({
      config: { tools: { web: { search: { provider: "firecrawl" } } } },
    });
    expect(searchKind(resolved)).toBe("http-first");
  });
});
