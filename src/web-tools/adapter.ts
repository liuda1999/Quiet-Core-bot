/**
 * Maps Quiet Core bot web tool config onto dsh-web-kit options.
 *
 * LOCAL CODE (not vendored). The config surface in `src/config/types.tools.ts`
 * is deliberately unchanged; only the runtime underneath it moves to the
 * vendored kit.
 */
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import { logWarn } from "../logger.js";
import { isHarnessError } from "./errors.js";
import type { SsrfOverrides } from "./fetch/network.js";
import { DEFAULT_FETCH_LIMITS, type HttpFetchLimits } from "./fetch/provider.js";
import type { SearchBackend, WebKitOptions } from "./index.js";
import { SEARXNG_DEFAULT_BASE_URL } from "./search/searxng.js";
import { DEFAULT_FETCH_MAX_OUTPUT_CHARS } from "./tools/fetch.js";

/** The pre-migration core default, kept so an unconfigured install does not flood context. */
export const DEFAULT_CORE_FETCH_MAX_CHARS = 20_000;
/** Mirrors `MAX_SEARCH_COUNT` in the core tool layer. */
export const MAX_SEARCH_RESULTS = 10;
/** Mirrors the upstream cap on one `web_search` call. */
export const MAX_SEARCH_QUERIES = 4;

export interface ResolvedWebToolsOptions {
  readonly options: WebKitOptions;
  readonly fingerprint: string;
  readonly searchMaxResults: number;
  readonly fetchMaxOutputChars: number;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function readNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) {
    return;
  }
  warned.add(message);
  logWarn(`[web-tools] ${message}`);
}

function buildSearchBackend(params: {
  provider: string;
  sandboxed: boolean;
  timeoutMs?: number;
}): SearchBackend {
  const timeout = params.timeoutMs !== undefined ? { timeoutMs: params.timeoutMs } : {};

  // A sandboxed run must not launch a host browser, so both browser-using
  // backends collapse to plain HTTP.
  if (params.sandboxed) {
    return { kind: "bing-html", options: timeout };
  }

  switch (params.provider) {
    case "":
    case "bing":
    case "bing-html":
    case "http-first":
      return { kind: "http-first", options: timeout };
    case "searxng":
      return {
        kind: "searxng",
        options: {
          baseUrl: process.env.SEARXNG_BASE_URL?.trim() || SEARXNG_DEFAULT_BASE_URL,
          ...timeout,
        },
      };
    case "ddg":
    case "ddg-html":
    case "duckduckgo":
      return { kind: "ddg-html", options: timeout };
    case "so360":
    case "so360-html":
      return { kind: "so360-html", options: timeout };
    case "browser":
      return { kind: "browser", options: { engine: "bing", ...timeout } };
    case "local-index":
      return { kind: "local-index" };
    default:
      warnOnce(
        `unknown tools.web.search.provider "${params.provider}"; using the built-in keyless backends`,
      );
      return { kind: "http-first", options: timeout };
  }
}

function buildFetchLimits(fetch: Record<string, unknown>): HttpFetchLimits {
  return {
    maxResponseBytes: readPositiveInteger(
      fetch.maxResponseBytes,
      DEFAULT_FETCH_LIMITS.maxResponseBytes,
    ),
    maxBodyChars: DEFAULT_FETCH_LIMITS.maxBodyChars,
    timeoutMs:
      readPositiveInteger(fetch.timeoutSeconds, DEFAULT_FETCH_LIMITS.timeoutMs / 1000) * 1000,
    maxRedirects: readNonNegativeInteger(fetch.maxRedirects, DEFAULT_FETCH_LIMITS.maxRedirects),
    userAgent:
      typeof fetch.userAgent === "string" && fetch.userAgent.trim().length > 0
        ? fetch.userAgent
        : DEFAULT_FETCH_LIMITS.userAgent,
  };
}

/** Resolve the effective kit options, a stable fingerprint, and the tool-layer caps. */
export function resolveWebToolsOptions(params: {
  config?: QuietCoreConfig;
  sandboxed?: boolean;
}): ResolvedWebToolsOptions {
  const web = params.config?.tools?.web;
  const search = readRecord(web?.search);
  const fetch = readRecord(web?.fetch);
  const sandboxed = params.sandboxed === true;

  const provider = typeof search.provider === "string" ? search.provider.trim().toLowerCase() : "";
  const searchTimeoutSeconds = readPositiveInteger(search.timeoutSeconds, 0);
  const backend = buildSearchBackend({
    provider,
    sandboxed,
    ...(searchTimeoutSeconds > 0 ? { timeoutMs: searchTimeoutSeconds * 1000 } : {}),
  });

  if (search.apiKey !== undefined) {
    warnOnce("tools.web.search.apiKey has no effect: the built-in backends need no API key");
  }
  if (search.cacheTtlMinutes !== undefined) {
    warnOnce("tools.web.search.cacheTtlMinutes has no effect: the built-in backends do not cache");
  }

  const ssrfPolicy = readRecord(fetch.ssrfPolicy);
  const ssrfOverrides: SsrfOverrides = {
    allowRfc2544BenchmarkRange: ssrfPolicy.allowRfc2544BenchmarkRange === true,
    allowIpv6UniqueLocalRange: ssrfPolicy.allowIpv6UniqueLocalRange === true,
  };

  if (fetch.readability === false) {
    warnOnce("tools.web.fetch.readability=false has no effect: every fetched page is extracted");
  }
  if (fetch.cacheTtlMinutes !== undefined) {
    warnOnce("tools.web.fetch.cacheTtlMinutes has no effect: the built-in fetcher does not cache");
  }
  const fetchProvider =
    typeof fetch.provider === "string" ? fetch.provider.trim().toLowerCase() : "";
  if (fetchProvider.length > 0 && !["http", "builtin", "dsh"].includes(fetchProvider)) {
    warnOnce(
      `tools.web.fetch.provider "${String(fetch.provider)}" is not used: the built-in fetcher handles every fetch`,
    );
  }

  const searchMaxResults = Math.min(
    Math.max(readPositiveInteger(search.maxResults, 8), 1),
    MAX_SEARCH_RESULTS,
  );
  const maxCharsCap = readPositiveInteger(fetch.maxCharsCap, DEFAULT_FETCH_MAX_OUTPUT_CHARS);
  const fetchMaxOutputChars = Math.min(
    Math.max(readPositiveInteger(fetch.maxChars, DEFAULT_CORE_FETCH_MAX_CHARS), 100),
    maxCharsCap,
  );

  const options: WebKitOptions = {
    search: backend,
    fetch: buildFetchLimits(fetch),
    // Rendering is reserved for real shells. The upstream default (1,500 chars)
    // treats short but complete pages as shells and pays a browser launch;
    // example.com extracts to 171 chars, so 100 keeps it on the HTTP path while
    // still catching SPA shells (<100 chars).
    render: sandboxed ? false : { minTextChars: 100 },
    searchMaxResults,
    searchMaxQueries: MAX_SEARCH_QUERIES,
    fetchMaxOutputChars,
    filter: {},
    fetchOptions: {
      useEnvProxy: fetch.useTrustedEnvProxy === true,
      ssrfOverrides,
    },
  };

  return {
    options,
    fingerprint: JSON.stringify(options),
    searchMaxResults,
    fetchMaxOutputChars,
  };
}

/**
 * Turn a kit error into the shape the core tool execution adapter expects.
 *
 * Cancellation is rethrown as the caller's own reason so the runtime keeps its
 * abort semantics; everything else becomes `"<tool> failed [CODE]: message"`.
 */
export function translateWebToolError(
  tool: "web_search" | "web_fetch",
  error: unknown,
  signal?: AbortSignal,
): Error {
  if (signal?.aborted === true) {
    const reason: unknown = signal.reason;
    return reason instanceof Error ? reason : new Error(`${tool} aborted`);
  }
  if (isHarnessError(error)) {
    return new Error(`${tool} failed [${error.code}]: ${error.message}`, { cause: error });
  }
  return error instanceof Error ? error : new Error(String(error));
}
