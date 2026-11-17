---
summary: "web_fetch tool -- HTTP fetch with readable content extraction"
read_when:
  - You want to fetch a URL and extract readable content
  - You need to configure web_fetch or its Firecrawl fallback
  - You want to understand web_fetch limits and caching
title: "Web fetch"
sidebarTitle: "Web Fetch"
---

The `web_fetch` tool does a plain HTTP GET and extracts readable content
(HTML to markdown or text). It does **not** execute JavaScript.

For JS-heavy sites or login-protected pages, use the
[Web Browser](/tools/browser) instead.

## Quick start

`web_fetch` is **enabled by default** -- no configuration needed. The agent can
call it immediately:

```javascript
await web_fetch({ url: "https://example.com/article" });
```

## Tool parameters

<ParamField path="url" type="string" required>
URL to fetch. `http(s)` only.
</ParamField>

<ParamField path="maxChars" type="number">
Truncate output to this many characters. Clamped to `tools.web.fetch.maxCharsCap`.
</ParamField>

## How it works

<Steps>
  <Step title="Resolve and pin">
    Resolves the hostname once, rejects any non-public address, and pins the
    validated address into the connection so a second DNS answer cannot redirect
    the request. Non-`http(s)` URLs and URLs with embedded credentials are
    rejected.
  </Step>
  <Step title="Fetch">
    Sends an HTTP GET with a bounded response size and timeout. Only same-origin
    redirects are followed, up to `maxRedirects`; a cross-origin redirect fails
    with `WEB_REDIRECT_BLOCKED` and must be retried directly.
  </Step>
  <Step title="Extract">
    Classifies the content type and extracts the main content. HTML is converted
    to Markdown; `text/*` is returned as-is.
  </Step>
  <Step title="Render fallback (optional)">
    When the static body is an empty shell, the same URL is rendered in a real
    browser (system Microsoft Edge or Google Chrome) and the rendered DOM is kept
    only when it scores higher than the static extraction.
  </Step>
</Steps>

## Progress updates

The built-in fetcher does not emit progress lines. The call returns when the
response is read, or after the render fallback finishes.

## Config

```json5
{
  tools: {
    web: {
      fetch: {
        enabled: true, // default: true
        maxChars: 20000, // max output chars
        maxCharsCap: 200000, // hard cap for the maxChars param
        maxResponseBytes: 5000000, // max download size before truncation
        timeoutSeconds: 30,
        maxRedirects: 5,
        useTrustedEnvProxy: false, // route through HTTP(S)_PROXY; default strict
        userAgent: "Mozilla/5.0 ...", // override User-Agent
        ssrfPolicy: {
          allowRfc2544BenchmarkRange: false, // opt-in for trusted fake-IP proxies using 198.18.0.0/15
          allowIpv6UniqueLocalRange: false, // opt-in for trusted fake-IP proxies using fc00::/7
        },
        // provider, cacheTtlMinutes, and readability are accepted for
        // compatibility but no longer change the built-in fetcher.
      },
    },
  },
}
```

## Firecrawl fallback

<Note>
  The built-in `web_fetch` always uses its own HTTP provider and render
  fallback. It no longer calls plugin fetch providers such as Firecrawl, and
  `tools.web.fetch.provider` does not change that behavior. This section
  documents the plugin SDK contract only.
</Note>

If Readability extraction fails, `web_fetch` can fall back to
[Firecrawl](/tools/firecrawl) for bot-circumvention and better extraction:

```json5
{
  tools: {
    web: {
      fetch: {
        provider: "firecrawl", // optional; omit for auto-detect from available credentials
      },
    },
  },
  plugins: {
    entries: {
      firecrawl: {
        enabled: true,
        config: {
          webFetch: {
            // apiKey: "fc-...", // optional; omit for keyless starter access
            baseUrl: "https://api.firecrawl.dev",
            onlyMainContent: true,
            maxAgeMs: 86400000, // cache duration (1 day)
            timeoutSeconds: 60,
          },
        },
      },
    },
  },
}
```

`plugins.entries.firecrawl.config.webFetch.apiKey` is optional and supports SecretRef objects.
Legacy `tools.web.fetch.firecrawl.*` config is auto-migrated by `quiet-core-bot doctor --fix`.

<Note>
  If you configure a Firecrawl API-key SecretRef and it is unresolved with no
  `FIRECRAWL_API_KEY` env fallback, gateway startup fails fast.
</Note>

<Note>
  Firecrawl `baseUrl` overrides are locked down: hosted traffic uses
  `https://api.firecrawl.dev`; self-hosted overrides must target private or
  internal endpoints, and `http://` is accepted only for those private targets.
</Note>

Current runtime behavior:

- `tools.web.fetch.provider` selects the fetch fallback provider explicitly.
- If `provider` is omitted, Quiet Core bot auto-detects the first ready web-fetch
  provider from configured credentials. Non-sandboxed `web_fetch` can use
  installed plugins that declare `contracts.webFetchProviders` and register a
  matching provider at runtime. The official Firecrawl plugin provides this
  fallback.
- Sandboxed `web_fetch` calls allow bundled providers plus installed providers
  whose official npm or ClawHub provenance is verified. Today that permits the
  official Firecrawl plugin; third-party external fetch plugins stay excluded.
- If Readability is disabled, `web_fetch` skips straight to the selected
  provider fallback. If no provider is available, it fails closed.

## Trusted env proxy

If your deployment requires `web_fetch` to go through a trusted outbound
HTTP(S) proxy, set `tools.web.fetch.useTrustedEnvProxy: true`.

In this mode, Quiet Core bot still applies hostname-based SSRF checks before sending
the request, but it lets the proxy resolve DNS instead of doing local DNS
pinning. Enable this only when the proxy is operator-controlled and enforces
outbound policy after DNS resolution.

<Note>
  If no HTTP(S) proxy env var is configured, or the target host is excluded by
  `NO_PROXY`, `web_fetch` falls back to the normal strict path with local DNS
  pinning.
</Note>

## Limits and safety

- `maxChars` is clamped to `tools.web.fetch.maxCharsCap`
- Response body is capped at `maxResponseBytes` before parsing; oversized
  responses are truncated with a warning
- Private/internal hostnames are blocked
- `tools.web.fetch.ssrfPolicy.allowRfc2544BenchmarkRange` and
  `tools.web.fetch.ssrfPolicy.allowIpv6UniqueLocalRange` are narrow opt-ins
  for trusted fake-IP proxy stacks; leave them unset unless your proxy owns
  those synthetic ranges and enforces its own destination policy
- Only same-origin redirects are followed, up to `maxRedirects`; a cross-origin
  redirect fails with `WEB_REDIRECT_BLOCKED`
- The static body is capped at 5 MB and 300,000 characters
- A page that looks like an empty shell is rendered in the system browser; the
  rendered DOM is kept only when it scores higher than the static extraction
- `useTrustedEnvProxy` is an explicit opt-in and should only be enabled for
  operator-controlled proxies that still enforce outbound policy after DNS
  resolution
- `web_fetch` is best-effort -- some sites need the [Web Browser](/tools/browser)

## Tool profiles

If you use tool profiles or allowlists, add `web_fetch` or `group:web`:

```json5
{
  tools: {
    allow: ["web_fetch"],
    // or: allow: ["group:web"]  (includes web_fetch, web_search, and x_search)
  },
}
```

## Related

- [Web Search](/tools/web) -- search the web with multiple providers
- [Web Browser](/tools/browser) -- full browser automation for JS-heavy sites
- [Firecrawl](/tools/firecrawl) -- Firecrawl search and scrape tools
