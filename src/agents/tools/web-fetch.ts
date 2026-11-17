/**
 * web_fetch built-in tool.
 *
 * Backed by the vendored dsh-web-kit runtime: address-pinned HTTP fetch with
 * same-origin redirects, body limits, content extraction, and a browser render
 * fallback for shell pages. The config surface is unchanged; see
 * `src/web-tools/adapter.ts`.
 */
import { Type } from "typebox";
import type { QuietCoreConfig } from "../../config/types.quiet-core-bot.js";
import type { RuntimeWebFetchMetadata } from "../../secrets/runtime-web-tools.types.js";
import { wrapExternalContent } from "../../security/external-content.js";
import { resolveWebToolsOptions, translateWebToolError } from "../../web-tools/adapter.js";
import { getWebKit } from "../../web-tools/kit-singleton.js";
import { formatFetchOutput } from "../../web-tools/tools/fetch.js";
import type { AnyAgentTool } from "./common.js";
import { textResult } from "./common.js";
import { resolveWebFetchToolRuntimeContext } from "./web-tool-runtime-context.js";

const WebFetchSchema = Type.Object({
  url: Type.String({ description: "HTTP(S) URL." }),
  maxChars: Type.Optional(
    Type.Integer({
      description: "Max chars returned; truncates.",
      minimum: 100,
    }),
  ),
});

type WebFetchConfig = NonNullable<QuietCoreConfig["tools"]>["web"] extends infer Web
  ? Web extends { fetch?: infer Fetch }
    ? Fetch
    : undefined
  : undefined;

function resolveFetchEnabled(fetch?: WebFetchConfig): boolean {
  if (typeof fetch?.enabled === "boolean") {
    return fetch.enabled;
  }
  return true;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeFetchArgs(args: unknown): { url: string; maxChars?: number } {
  const record = readRecord(args);
  const url = typeof record.url === "string" ? record.url.trim() : "";
  if (url.length === 0) {
    throw new Error("web_fetch failed [WEB_INVALID_ARGS]: url must be a non-empty string");
  }

  const rawMaxChars = record.maxChars;
  const maxChars =
    typeof rawMaxChars === "number" && Number.isFinite(rawMaxChars)
      ? Math.floor(rawMaxChars)
      : undefined;
  return { url, ...(maxChars !== undefined ? { maxChars } : {}) };
}

/** Creates the `web_fetch` tool, or `null` when web fetch is disabled by config. */
export function createWebFetchTool(options?: {
  config?: QuietCoreConfig;
  sandboxed?: boolean;
  runtimeWebFetch?: RuntimeWebFetchMetadata;
  lateBindRuntimeConfig?: boolean;
}): AnyAgentTool | null {
  const initialConfig = options?.config;
  if (!resolveFetchEnabled(initialConfig?.tools?.web?.fetch)) {
    return null;
  }

  return {
    label: "Web Fetch",
    name: "web_fetch",
    description: "Fetch the content of a specific HTTP(S) URL and return it decoded to text.",
    parameters: WebFetchSchema,
    execute: async (_toolCallId, args, signal) => {
      const { config } = resolveWebFetchToolRuntimeContext({
        config: initialConfig,
        lateBindRuntimeConfig: options?.lateBindRuntimeConfig,
        runtimeWebFetch: options?.runtimeWebFetch,
      });
      if (!resolveFetchEnabled(config?.tools?.web?.fetch)) {
        throw new Error("web_fetch is disabled.");
      }

      const { url, maxChars } = normalizeFetchArgs(args);
      const resolved = resolveWebToolsOptions({ config, sandboxed: options?.sandboxed });
      const kit = getWebKit(resolved.options, resolved.fingerprint);
      const outputChars =
        maxChars !== undefined
          ? Math.min(Math.max(maxChars, 100), resolved.fetchMaxOutputChars)
          : resolved.fetchMaxOutputChars;

      try {
        const result = await kit.web.fetch({ url }, signal);
        const text = wrapExternalContent(formatFetchOutput(result, outputChars), {
          source: "web_fetch",
          includeWarning: false,
        });
        return textResult(text, result);
      } catch (error: unknown) {
        throw translateWebToolError("web_fetch", error, signal);
      }
    },
  };
}
