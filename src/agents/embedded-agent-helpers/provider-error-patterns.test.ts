// Covers provider-specific error-pattern classification hooks.
import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  classifyProviderFailoverReasonWithPlugin: vi.fn(() => null),
  matchesProviderContextOverflowWithPlugin: vi.fn(() => false),
}));

vi.mock("../../plugins/provider-runtime.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/provider-runtime.js")>(
    "../../plugins/provider-runtime.js",
  );
  return {
    ...actual,
    classifyProviderFailoverReasonWithPlugin: hoisted.classifyProviderFailoverReasonWithPlugin,
    matchesProviderContextOverflowWithPlugin: hoisted.matchesProviderContextOverflowWithPlugin,
  };
});

import {
  classifyFailoverReason,
  classifyProviderRuntimeFailureKind,
  isContextOverflowError,
} from "./errors.js";
import {
  classifyProviderSpecificError,
  matchesProviderContextOverflow,
  resolveProviderContextLimitMismatch,
} from "./provider-error-patterns.js";

describe("resolveProviderContextLimitMismatch", () => {
  it("flags an under-declared window using the provider's own stated limit", () => {
    // R8-A4 shape: declared 200000 while the provider enforces 1048576.
    expect(
      resolveProviderContextLimitMismatch({
        errorMessage:
          "This model's maximum context length is 1048576 tokens. However, you requested 1248576 tokens (1248574 in the messages, 2 in the completion).",
        declaredContextWindow: 200000,
      }),
    ).toEqual({
      statedLimitTokens: 1048576,
      declaredContextWindow: 200000,
      direction: "under-declared",
      ratio: 5.24,
    });
  });

  it("flags an over-declared window", () => {
    expect(
      resolveProviderContextLimitMismatch({
        errorMessage: "prompt is too long: 213462 tokens > 200000 maximum",
        declaredContextWindow: 400000,
      }),
    ).toEqual({
      statedLimitTokens: 200000,
      declaredContextWindow: 400000,
      direction: "over-declared",
      ratio: 2,
    });
  });

  it("supports llama.cpp / LiteLLM / Mistral wording", () => {
    expect(
      resolveProviderContextLimitMismatch({
        errorMessage:
          "400 request (66202 tokens) exceeds the available context size (65536 tokens), try increasing it",
        declaredContextWindow: 131072,
      })?.statedLimitTokens,
    ).toBe(65536);
    expect(
      resolveProviderContextLimitMismatch({
        errorMessage:
          "Requested token count exceeds the model's maximum context length of 131072 tokens",
        declaredContextWindow: 4096,
      })?.direction,
    ).toBe("under-declared");
  });

  it("stays quiet when the provider agrees with the declaration", () => {
    expect(
      resolveProviderContextLimitMismatch({
        errorMessage: "This model's maximum context length is 131072 tokens.",
        declaredContextWindow: 131072,
      }),
    ).toBeUndefined();
  });

  it("stays quiet without a declared window or without a stated limit", () => {
    expect(
      resolveProviderContextLimitMismatch({
        errorMessage: "This model's maximum context length is 131072 tokens.",
        declaredContextWindow: undefined,
      }),
    ).toBeUndefined();
    expect(
      resolveProviderContextLimitMismatch({
        errorMessage: "400 status code (no body)",
        declaredContextWindow: 200000,
      }),
    ).toBeUndefined();
  });
});

describe("matchesProviderContextOverflow", () => {
  it("skips provider hook dispatch for unrelated errors", () => {
    // Avoid calling plugin hooks for obviously unrelated text so classifier hot
    // paths stay cheap and side-effect free.
    hoisted.matchesProviderContextOverflowWithPlugin.mockClear();

    expect(
      matchesProviderContextOverflow("Permission denied for /root/oc-acp-write-should-fail.txt."),
    ).toBe(false);
    expect(hoisted.matchesProviderContextOverflowWithPlugin).not.toHaveBeenCalled();
  });

  it.each([
    // AWS Bedrock
    "ValidationException: The input is too long for the model",
    "ValidationException: Input token count exceeds the maximum number of input tokens",
    "ModelStreamErrorException: Input is too long for this model",

    // Google Vertex
    "INVALID_ARGUMENT: input exceeds the maximum number of tokens",

    // Ollama
    "ollama error: context length exceeded, too many tokens",

    // Mistral
    "mistral: input is too long for this model",

    // Cohere
    "total tokens exceeds the model's maximum limit of 4096",

    // llama.cpp HTTP server (slot ctx-size overflow)
    "400 request (66202 tokens) exceeds the available context size (65536 tokens), try increasing it",
    "request (130000 tokens) exceeds available context size (131072 tokens)",
    "prompt (8500 tokens) exceeds the available context size (8192 tokens), try increasing it",

    // Generic
    "input is too long for model gpt-5.4",
  ])("matches provider-specific overflow: %s", (msg) => {
    expect(matchesProviderContextOverflow(msg)).toBe(true);
  });

  it("does not match unrelated errors", () => {
    hoisted.matchesProviderContextOverflowWithPlugin.mockClear();
    expect(matchesProviderContextOverflow("rate limit exceeded")).toBe(false);
    expect(matchesProviderContextOverflow("invalid api key")).toBe(false);
    expect(matchesProviderContextOverflow("internal server error")).toBe(false);
    expect(hoisted.matchesProviderContextOverflowWithPlugin).not.toHaveBeenCalled();
  });
});

describe("classifyProviderSpecificError", () => {
  it("classifies Bedrock ThrottlingException as rate_limit", () => {
    expect(classifyProviderSpecificError("ThrottlingException: Too many requests")).toBe(
      "rate_limit",
    );
  });

  it("classifies Bedrock ModelNotReadyException as overloaded", () => {
    expect(classifyProviderSpecificError("ModelNotReadyException: model is not ready")).toBe(
      "overloaded",
    );
  });

  it("classifies Groq model_deactivated as model_not_found", () => {
    expect(classifyProviderSpecificError("model_is_deactivated")).toBe("model_not_found");
  });

  it("classifies concurrency limit as rate_limit", () => {
    expect(classifyProviderSpecificError("concurrency limit has been reached")).toBe("rate_limit");
    expect(classifyProviderSpecificError("concurrency limit reached")).toBe("rate_limit");
  });

  it("classifies Cloudflare Workers AI quota errors as rate_limit", () => {
    expect(classifyProviderSpecificError("workers_ai gateway error: quota limit exceeded")).toBe(
      "rate_limit",
    );
  });

  it("does not match generic 'model is not ready' without Bedrock prefix", () => {
    expect(classifyProviderSpecificError("model is not ready")).toBeNull();
  });

  it("returns null for unmatched errors", () => {
    expect(classifyProviderSpecificError("some random error")).toBeNull();
  });
});

describe("isContextOverflowError with provider patterns", () => {
  it("detects Bedrock ValidationException as context overflow", () => {
    expect(isContextOverflowError("ValidationException: The input is too long for the model")).toBe(
      true,
    );
  });

  it("detects Ollama context overflow", () => {
    expect(isContextOverflowError("ollama error: context length exceeded")).toBe(true);
  });

  it("detects llama.cpp slot ctx-size overflow", () => {
    // Native llama.cpp HTTP server overflow surfaced through openai-completions providers.
    expect(
      isContextOverflowError(
        "400 request (66202 tokens) exceeds the available context size (65536 tokens), try increasing it",
      ),
    ).toBe(true);
  });

  it("still detects standard context overflow patterns", () => {
    expect(isContextOverflowError("context length exceeded")).toBe(true);
    expect(isContextOverflowError("prompt is too long: 150000 tokens > 128000 maximum")).toBe(true);
  });
});

describe("classifyFailoverReason with provider patterns", () => {
  it("classifies Bedrock ThrottlingException via provider patterns", () => {
    expect(classifyFailoverReason("ThrottlingException: Too many concurrent requests")).toBe(
      "rate_limit",
    );
  });

  it("classifies Groq model_deactivated via provider patterns", () => {
    expect(classifyFailoverReason("model_is_deactivated: this model has been deactivated")).toBe(
      "model_not_found",
    );
  });

  it("classifies xAI 429 credit exhaustion as billing before resource-exhausted rate limits", () => {
    // xAI uses resource-exhausted language for credit failures, so billing must
    // win before generic 429/rate-limit handling.
    expect(
      classifyFailoverReason(
        '429 {"code":"Some resource has been exhausted","error":"Your team team-redacted has either used all available credits or reached its monthly spending limit. To continue making API requests, please purchase more credits or raise your spending limit."}',
        { provider: "xai" },
      ),
    ).toBe("billing");
  });
});

describe("Cloudflare / CDN HTML error page classification (#67517)", () => {
  const cloudflareHtml502 =
    "<!doctype html><html><head><title>502 Bad Gateway</title></head>" +
    "<body><h1>502 Bad Gateway</h1><p>cloudflare-nginx</p></body></html>";
  const cloudflareHtml503 =
    "<!doctype html><html><head><title>503</title></head>" +
    "<body><h1>Service Unavailable</h1><p>Please try again. Rate limit exceeded.</p></body></html>";
  const html401 =
    "<!doctype html><html><head><title>401 Unauthorized</title></head>" +
    "<body><h1>Unauthorized</h1></body></html>";
  const html403 =
    "<!doctype html><html><head><title>403 Forbidden</title></head>" +
    "<body><h1>Forbidden</h1></body></html>";
  const html407 =
    "<!doctype html><html><head><title>407 Proxy Authentication Required</title></head>" +
    "<body><h1>Proxy Authentication Required</h1></body></html>";
  const html402 =
    "<!doctype html><html><head><title>402 Payment Required</title></head>" +
    "<body><h1>Payment Required</h1><p>Your quota is exhausted.</p></body></html>";
  const html429 =
    "<!doctype html><html><head><title>429 Too Many Requests</title></head>" +
    "<body><h1>Too Many Requests</h1><p>Rate limit exceeded.</p></body></html>";
  const prefixedHtml401 = `Error: 401 ${html401}`;
  const prefixedHtml407 = `Error: 407 ${html407}`;

  it("classifies Cloudflare HTML 502 as timeout", () => {
    expect(classifyFailoverReason(`502 ${cloudflareHtml502}`)).toBe("timeout");
  });

  it("classifies Cloudflare HTML 503 with rate-limit text as timeout", () => {
    // CDN HTML wrappers are upstream availability failures even when the page
    // body contains generic rate-limit words.
    expect(classifyFailoverReason(`503 ${cloudflareHtml503}`)).toBe("timeout");
  });

  it("preserves auth classification for 401 HTML", () => {
    expect(classifyFailoverReason(`401 ${html401}`)).toBe("auth");
  });

  it("preserves auth classification for 403 HTML", () => {
    expect(classifyFailoverReason(`403 ${html403}`)).toBe("auth");
  });

  it("preserves auth classification for Error-prefixed 401 HTML", () => {
    expect(classifyFailoverReason(prefixedHtml401)).toBe("auth");
  });

  it("preserves billing classification for 402 HTML", () => {
    expect(classifyFailoverReason(`402 ${html402}`)).toBe("billing");
  });

  it("preserves rate-limit classification for 429 HTML", () => {
    expect(classifyFailoverReason(`429 ${html429}`)).toBe("rate_limit");
  });

  it("classifies runtime failure kind as upstream_html for non-auth HTML", () => {
    expect(classifyProviderRuntimeFailureKind({ status: 502, message: cloudflareHtml502 })).toBe(
      "upstream_html",
    );
  });

  it("classifies 403 HTML runtime failures as auth_html", () => {
    expect(classifyProviderRuntimeFailureKind({ status: 403, message: html403 })).toBe("auth_html");
  });

  it("classifies 407 HTML runtime failures as proxy", () => {
    expect(classifyProviderRuntimeFailureKind({ status: 407, message: html407 })).toBe("proxy");
  });

  it("classifies Error-prefixed 407 HTML runtime failures as proxy", () => {
    expect(classifyProviderRuntimeFailureKind(prefixedHtml407)).toBe("proxy");
  });

  it("does not misclassify JSON API rate-limit responses as HTML", () => {
    const jsonRateLimit =
      '429 {"error":{"type":"rate_limit_error","message":"Rate limit exceeded"}}';
    expect(classifyFailoverReason(jsonRateLimit)).toBe("rate_limit");
  });
});
