/**
 * web_search built-in tool.
 *
 * Backed by the vendored dsh-web-kit runtime: keyless Bing HTML search with a
 * browser fallback, plus optional SearXNG / DuckDuckGo / 360 / local-index
 * backends. The config surface is unchanged; see `src/web-tools/adapter.ts`.
 */
import { Type } from "typebox";
import type { QuietCoreConfig } from "../../config/types.quiet-core-bot.js";
import type { RuntimeWebSearchMetadata } from "../../secrets/runtime-web-tools.types.js";
import { wrapExternalContent } from "../../security/external-content.js";
import {
  MAX_SEARCH_QUERIES,
  MAX_SEARCH_RESULTS,
  resolveWebToolsOptions,
  translateWebToolError,
} from "../../web-tools/adapter.js";
import { getWebKit } from "../../web-tools/kit-singleton.js";
import { formatSearchOutput, runSearchQueries } from "../../web-tools/tools/search.js";
import type { AnyAgentTool } from "./common.js";
import { textResult } from "./common.js";
import { resolveWebSearchToolRuntimeContext } from "./web-tool-runtime-context.js";

const WebSearchSchema = Type.Object({
  queries: Type.Optional(
    Type.Array(Type.String(), {
      description: `1-${MAX_SEARCH_QUERIES} search queries; their results are merged.`,
    }),
  ),
  query: Type.Optional(
    Type.String({ description: "Deprecated: a single query, equivalent to queries: [query]." }),
  ),
  count: Type.Optional(
    Type.Integer({
      description: "Maximum sources to return.",
      minimum: 1,
      maximum: MAX_SEARCH_RESULTS,
    }),
  ),
});

function isWebSearchDisabled(config?: QuietCoreConfig): boolean {
  const search = config?.tools?.web?.search;
  return Boolean(search && typeof search === "object" && search.enabled === false);
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Explains an empty `site:` result set. The constraint is enforced locally
 * because scraped backends drop the operator, so an empty list is expected
 * behaviour rather than a broken search.
 */
function formatEmptySiteResults(host: string): string {
  return [
    `No results matched inside ${host}.`,
    "",
    `The site: constraint is enforced locally: only pages on ${host} or its subdomains can be returned.`,
    "The backend does not honor site: itself, so coverage depends on what it already ranks for the query.",
    "Remove site: or rephrase the query to widen the search.",
  ].join("\n");
}

function normalizeSearchArgs(args: unknown): { queries: string[]; count?: number } {
  const record = readRecord(args);
  const listed = Array.isArray(record.queries)
    ? record.queries.filter((value): value is string => typeof value === "string")
    : [];
  const single = typeof record.query === "string" ? record.query : "";
  const candidates = listed.length > 0 ? listed : single.length > 0 ? [single] : [];

  const seen = new Set<string>();
  const queries: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    queries.push(trimmed);
    if (queries.length >= MAX_SEARCH_QUERIES) {
      break;
    }
  }
  if (queries.length === 0) {
    throw new Error(
      "web_search failed [WEB_INVALID_ARGS]: queries must be a non-empty string array",
    );
  }

  const rawCount = record.count;
  const count =
    typeof rawCount === "number" && Number.isFinite(rawCount)
      ? Math.min(Math.max(Math.floor(rawCount), 1), MAX_SEARCH_RESULTS)
      : undefined;
  return { queries, ...(count !== undefined ? { count } : {}) };
}

/** Creates the `web_search` tool, or `null` when web search is disabled by config. */
export function createWebSearchTool(options?: {
  config?: QuietCoreConfig;
  agentDir?: string;
  sandboxed?: boolean;
  runtimeWebSearch?: RuntimeWebSearchMetadata;
  lateBindRuntimeConfig?: boolean;
}): AnyAgentTool | null {
  if (isWebSearchDisabled(options?.config)) {
    return null;
  }

  return {
    label: "Web Search",
    name: "web_search",
    description:
      "Search the web for current information. Returns an optional summary answer and a list of source URLs.",
    parameters: WebSearchSchema,
    execute: async (_toolCallId, args, signal) => {
      const { config } = resolveWebSearchToolRuntimeContext({
        config: options?.config,
        lateBindRuntimeConfig: options?.lateBindRuntimeConfig,
        runtimeWebSearch: options?.runtimeWebSearch,
      });
      if (isWebSearchDisabled(config)) {
        throw new Error("web_search is disabled.");
      }

      const { queries, count } = normalizeSearchArgs(args);
      const resolved = resolveWebToolsOptions({ config, sandboxed: options?.sandboxed });
      const kit = getWebKit(resolved.options, resolved.fingerprint);

      try {
        const result = await runSearchQueries(
          kit.web,
          queries,
          count ?? resolved.searchMaxResults,
          signal,
        );
        const text = wrapExternalContent(formatSearchOutput(result), {
          source: "web_search",
          includeWarning: false,
        });
        return textResult(text, result);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // `site:` is enforced locally, so "nothing matched inside that host" is
        // an answer, not a failure: the model and the user need to see why the
        // list is empty instead of an error they cannot act on.
        const siteMiss = /no results inside ([^\s,;)"]+)/u.exec(message);
        if (siteMiss !== null) {
          const host = siteMiss[1] ?? "the requested site";
          return textResult(
            wrapExternalContent(formatEmptySiteResults(host), {
              source: "web_search",
              includeWarning: false,
            }),
            { sources: [], truncated: false },
          );
        }
        throw translateWebToolError("web_search", error, signal);
      }
    },
  };
}
