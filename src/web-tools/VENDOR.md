# Vendored: dsh-web-kit

Upstream: <https://github.com/liuda1999/dsh-web-kit>
Version: `0.8.0`
Commit: `79f19c4127052e416c858a0814c5dc9b3da20a11` (2026-10-10)
License: MIT — see `LICENSE.dsh-web-kit` and `ATTRIBUTION.dsh-web-kit.md` in this directory,
plus the `dsh-web-kit` section in the repository-root `THIRD_PARTY_NOTICES.md`.

This directory is a 1:1 copy of upstream `src/`. Relative imports keep their upstream
`./x.js` form; nothing was renamed. Do not edit files here except for the patches listed
below — rebase them when syncing a new upstream tag.

## Local patches

1. `browser/pool.ts` — import `playwright-core` instead of `playwright`; the channel
   fallback list is `['msedge', 'chrome']` with no bundled-Chromium entry, so a missing
   browser degrades to `WEB_PROVIDER_UNAVAILABLE`. Missing-dependency message reworded.
2. `fetch/provider.ts` — `HttpFetchOptions { useEnvProxy, ssrfOverrides }`. Env proxy
   routing is opt-in (default `false`), matching the core
   `tools.web.fetch.useTrustedEnvProxy` strict default.
3. `fetch/network.ts` — `SsrfOverrides` adds explicit opt-outs for the RFC 2544
   benchmark range (`198.18.0.0/15`) and IPv6 unique-local (`fc00::/7`). Both default
   to `false`; only `tools.web.fetch.ssrfPolicy` turns them on.
4. `index.ts` — dropped an unused `DocStore` import so the core `noUnusedLocals`
   check passes.

## File map

| Upstream                                                                        | Here                     |
| ------------------------------------------------------------------------------- | ------------------------ |
| `src/index.ts`, `errors.ts`, `types.ts`, `runtime.ts`, `timeout.ts`, `proxy.ts` | `src/web-tools/`         |
| `src/fetch/{provider,network,policy,render-fallback}.ts`                        | `src/web-tools/fetch/`   |
| `src/search/{bing-html,ddg-html,searxng,so360-html,fallback,html-text}.ts`      | `src/web-tools/search/`  |
| `src/browser/{pool,engines,provider,fetch-provider}.ts`                         | `src/web-tools/browser/` |
| `src/filter/{controls,extract,result-filter}.ts`                                | `src/web-tools/filter/`  |
| `src/local/{bm25,caching-fetch,provider,store}.ts`                              | `src/web-tools/local/`   |
| `src/tools/{definitions,fetch,html,search,trust}.ts`                            | `src/web-tools/tools/`   |
| `src/turndown-plugin-gfm.d.ts`                                                  | `src/web-tools/`         |

## Sync procedure

```bash
git clone --depth 1 --branch <tag> https://github.com/liuda1999/dsh-web-kit .tmp/dsh-web-kit
cp -r .tmp/dsh-web-kit/src/. src/web-tools/
```

Then re-apply the four patches above and run `pnpm tsgo:core`.
