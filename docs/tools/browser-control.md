---
summary: "Quiet Core bot browser control API, CLI reference, and scripting actions"
read_when:
  - Scripting or debugging the agent browser via the local control API
  - Looking for the `quiet-core-bot browser` CLI reference
  - Adding custom browser automation with snapshots and refs
title: "Browser control API"
---

For setup, configuration, and troubleshooting, see [Browser](/tools/browser).
This page is the reference for the local control HTTP API, the `quiet-core-bot browser`
CLI, and scripting patterns (snapshots, refs, waits, debug flows).

## Control API (optional)

For local integrations only, the Gateway exposes a small loopback HTTP API.
This standalone server is opt-in — set the environment variable
`QUIET_CORE_EAGER_BROWSER_CONTROL_SERVER=1` in the gateway service environment
and restart the gateway before the HTTP endpoints become available. Without
this variable the browser control runtime still works through the CLI and
agent tools, but nothing listens on the loopback control port.

- Status/start/stop: `GET /`, `POST /start`, `POST /stop`
- Tabs: `GET /tabs`, `POST /tabs/open`, `POST /tabs/focus`, `DELETE /tabs/:targetId`
- Snapshot/screenshot: `GET /snapshot`, `POST /screenshot`
- Actions: `POST /navigate`, `POST /act`
- Hooks: `POST /hooks/file-chooser`, `POST /hooks/dialog`
- Downloads: `POST /download`, `POST /wait/download`
- Permissions: `POST /permissions/grant`
- Debugging: `GET /console`, `POST /pdf`
- Debugging: `GET /errors`, `GET /requests`, `POST /trace/start`, `POST /trace/stop`, `POST /highlight`
- Network: `POST /response/body`
- State: `GET /cookies`, `POST /cookies/set`, `POST /cookies/clear`
- State: `GET /storage/:kind`, `POST /storage/:kind/set`, `POST /storage/:kind/clear`
- Settings: `POST /set/offline`, `POST /set/headers`, `POST /set/credentials`, `POST /set/geolocation`, `POST /set/media`, `POST /set/timezone`, `POST /set/locale`, `POST /set/device`

All endpoints accept `?profile=<name>`. `POST /start?headless=true` requests a
one-shot headless launch for local managed profiles without changing persisted
browser config; attach-only, remote CDP, and existing-session profiles reject
that override because Quiet Core bot does not launch those browser processes.

For tab endpoints, `targetId` is the compatibility field name. Prefer passing
`suggestedTargetId` from `GET /tabs` or `POST /tabs/open`; labels and `tabId`
handles such as `t1` are also accepted. Raw CDP target ids and unique raw
target-id prefixes still work, but they are volatile diagnostic handles.

If shared-secret gateway auth is configured, browser HTTP routes require auth too:

- `Authorization: Bearer <gateway token>`
- `x-quiet-core-bot-password: <gateway password>` or HTTP Basic auth with that password

Notes:

- This standalone loopback browser API does **not** consume trusted-proxy or
  Tailscale Serve identity headers.
- If `gateway.auth.mode` is `none` or `trusted-proxy`, these loopback browser
  routes do not inherit those identity-bearing modes; keep them loopback-only.

### `/act` error contract

`POST /act` uses a structured error response for route-level validation and
policy failures:

```json
{ "error": "<message>", "code": "ACT_*" }
```

Current `code` values:

- `ACT_KIND_REQUIRED` (HTTP 400): `kind` is missing or unrecognized.
- `ACT_INVALID_REQUEST` (HTTP 400): action payload failed normalization or validation.
- `ACT_SELECTOR_UNSUPPORTED` (HTTP 400): `selector` was used with an unsupported action kind.
- `ACT_EVALUATE_DISABLED` (HTTP 403): `evaluate` (or `wait --fn`) is disabled by config.
- `ACT_TARGET_ID_MISMATCH` (HTTP 403): top-level or batched `targetId` conflicts with request target.
- `ACT_EXISTING_SESSION_UNSUPPORTED` (HTTP 501): action is not supported for existing-session profiles.

Other runtime failures may still return `{ "error": "<message>" }` without a
`code` field.

### Playwright requirement

Some features (navigate/act/AI snapshot/role snapshot, element screenshots,
PDF) require Playwright. If Playwright isn't installed, those endpoints return
a clear 501 error.

What still works without Playwright:

- ARIA snapshots
- Role-style accessibility snapshots (`--interactive`, `--compact`,
  `--depth`, `--efficient`) when a per-tab CDP WebSocket is available. This is
  a fallback for inspection and ref discovery; Playwright remains the primary
  action engine.
- Page screenshots for the managed `quiet-core-bot` browser when a per-tab CDP
  WebSocket is available
- Page screenshots for `existing-session` / Chrome MCP profiles
- `existing-session` ref-based screenshots (`--ref`) from snapshot output

What still needs Playwright:

- `navigate`
- `act`
- AI snapshots that depend on Playwright's native AI snapshot format
- CSS-selector element screenshots (`--element`)
- full browser PDF export

Element screenshots also reject `--full-page`; the route returns `fullPage is
not supported for element screenshots`.

If you see `Playwright is not available in this gateway build`, the packaged
Gateway is missing the core browser runtime dependency. Reinstall or update
Quiet Core bot, then restart the gateway. For Docker, also install the Chromium
browser binaries as shown below.

#### Docker Playwright install

If your Gateway runs in Docker, avoid `npx playwright` (npm override conflicts).
For custom images, bake Chromium into the image:

```bash
QUIET_CORE_INSTALL_BROWSER=1 ./scripts/docker/setup.sh
```

For an existing image, install through the bundled CLI instead:

```bash
docker compose run --rm quiet-core-bot-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

To persist browser downloads, set `PLAYWRIGHT_BROWSERS_PATH` (for example,
`/home/node/.cache/ms-playwright`) and make sure `/home/node` is persisted via
`QUIET_CORE_HOME_VOLUME` or a bind mount. Quiet Core bot auto-detects the persisted
Chromium on Linux. See [Docker](/install/docker).

## How it works (internal)

A small loopback control server accepts HTTP requests and connects to Chromium-based browsers via CDP. Advanced actions (click/type/snapshot/PDF) go through Playwright on top of CDP; when Playwright is missing, only non-Playwright operations are available. The agent sees one stable interface while local/remote browsers and profiles swap freely underneath.

## CLI quick reference

All commands accept `--browser-profile <name>` to target a specific profile, and `--json` for machine-readable output.

<AccordionGroup>

<Accordion title="Basics: status, tabs, open/focus/close">

```bash
quiet-core-bot browser status
quiet-core-bot browser start
quiet-core-bot browser start --headless # one-shot local managed headless launch
quiet-core-bot browser stop            # also clears emulation on attach-only/remote CDP
quiet-core-bot browser tabs
quiet-core-bot browser tab             # shortcut for current tab
quiet-core-bot browser tab new
quiet-core-bot browser tab select 2
quiet-core-bot browser tab close 2
quiet-core-bot browser open https://example.com
quiet-core-bot browser focus abcd1234
quiet-core-bot browser close abcd1234
```

</Accordion>

<Accordion title="Inspection: screenshot, snapshot, console, errors, requests">

```bash
quiet-core-bot browser screenshot
quiet-core-bot browser screenshot --full-page
quiet-core-bot browser screenshot --ref 12        # or --ref e12
quiet-core-bot browser screenshot --labels
quiet-core-bot browser snapshot
quiet-core-bot browser snapshot --format aria --limit 200
quiet-core-bot browser snapshot --interactive --compact --depth 6
quiet-core-bot browser snapshot --efficient
quiet-core-bot browser snapshot --labels
quiet-core-bot browser snapshot --urls
quiet-core-bot browser snapshot --selector "#main" --interactive
quiet-core-bot browser snapshot --frame "iframe#main" --interactive
quiet-core-bot browser console --level error
quiet-core-bot browser errors --clear
quiet-core-bot browser requests --filter api --clear
quiet-core-bot browser pdf
quiet-core-bot browser responsebody "**/api" --max-chars 5000
```

</Accordion>

<Accordion title="Actions: navigate, click, type, drag, wait, evaluate">

```bash
quiet-core-bot browser navigate https://example.com
quiet-core-bot browser resize 1280 720
quiet-core-bot browser click 12 --double           # or e12 for role refs
quiet-core-bot browser click-coords 120 340        # viewport coordinates
quiet-core-bot browser type 23 "hello" --submit
quiet-core-bot browser press Enter
quiet-core-bot browser hover 44
quiet-core-bot browser scrollintoview e12
quiet-core-bot browser drag 10 11
quiet-core-bot browser select 9 OptionA OptionB
quiet-core-bot browser download e12 report.pdf
quiet-core-bot browser waitfordownload report.pdf
quiet-core-bot browser upload /tmp/quiet-core-bot/uploads/file.pdf
quiet-core-bot browser upload media://inbound/file.pdf
quiet-core-bot browser fill --fields '[{"ref":"1","type":"text","value":"Ada"}]'
quiet-core-bot browser dialog --accept
quiet-core-bot browser dialog --dismiss --dialog-id d1
quiet-core-bot browser wait --text "Done"
quiet-core-bot browser wait "#main" --url "**/dash" --load networkidle --fn "window.ready===true"
quiet-core-bot browser evaluate --fn '(el) => el.textContent' --ref 7
quiet-core-bot browser evaluate --fn 'const title = document.title; return title;'
quiet-core-bot browser evaluate --timeout-ms 30000 --fn 'async () => { await window.ready; return true; }'
quiet-core-bot browser highlight e12
quiet-core-bot browser trace start
quiet-core-bot browser trace stop
```

</Accordion>

<Accordion title="State: cookies, storage, offline, headers, geo, device">

```bash
quiet-core-bot browser cookies
quiet-core-bot browser cookies set session abc123 --url "https://example.com"
quiet-core-bot browser cookies clear
quiet-core-bot browser storage local get
quiet-core-bot browser storage local set theme dark
quiet-core-bot browser storage session clear
quiet-core-bot browser set offline on
quiet-core-bot browser set headers --headers-json '{"X-Debug":"1"}'
quiet-core-bot browser set credentials user pass            # --clear to remove
quiet-core-bot browser set geo 37.7749 -122.4194 --origin "https://example.com"
quiet-core-bot browser set media dark
quiet-core-bot browser set timezone America/New_York
quiet-core-bot browser set locale en-US
quiet-core-bot browser set device "iPhone 14"
```

</Accordion>

</AccordionGroup>

Notes:

- `upload` and `dialog` are **arming** calls; run them before the click/press that triggers the chooser/dialog. If an action opens a modal, the action response includes `blockedByDialog` and `browserState.dialogs.pending`; pass that `dialogId` to respond directly. Dialogs handled outside Quiet Core bot appear under `browserState.dialogs.recent`.
- `click`/`type`/etc require a `ref` from `snapshot` (numeric `12`, role ref `e12`, or actionable ARIA ref `ax12`). CSS selectors are intentionally not supported for actions. Use `click-coords` when the visible viewport position is the only reliable target.
- Download and trace paths are constrained to Quiet Core bot temp roots: `/tmp/quiet-core-bot{,/downloads}` (fallback: `${os.tmpdir()}/quiet-core-bot/...`).
- `upload` accepts files from the Quiet Core bot temp uploads root and
  Quiet Core bot-managed inbound media. Managed inbound media can be referenced as
  `media://inbound/<id>`, sandbox-relative `media/inbound/<id>`, or a resolved
  path inside the managed inbound media directory. Nested media refs,
  traversal, symlinks, hardlinks, and arbitrary local paths are still rejected.
- `upload` can also set file inputs directly via `--input-ref` or `--element`.

Stable tab ids and labels survive Chromium raw-target replacement when Quiet Core bot
can prove the replacement tab, such as same URL or a single old tab becoming a
single new tab after form submission. Raw target ids are still volatile; prefer
`suggestedTargetId` from `tabs` in scripts.

Snapshot flags at a glance:

- `--format ai` (default with Playwright): AI snapshot with numeric refs (`aria-ref="<n>"`).
- `--format aria`: accessibility tree with `axN` refs. When Playwright is available, Quiet Core bot binds refs with backend DOM ids to the live page so follow-up actions can use them; otherwise treat the output as inspection-only.
- `--efficient` (or `--mode efficient`): compact role snapshot preset. Set `browser.snapshotDefaults.mode: "efficient"` to make this the default (see [Gateway configuration](/gateway/configuration-reference#browser)).
- `--interactive`, `--compact`, `--depth`, `--selector` force a role snapshot with `ref=e12` refs. `--frame "<iframe>"` scopes role snapshots to an iframe.
- With Playwright, `--labels` adds a screenshot with overlayed ref labels
  (prints `MEDIA:<path>`) plus an `annotations` array with each ref's bounding
  box. On `screenshot`, Playwright-backed labels work with `--full-page`,
  `--ref`, and `--element`; on `snapshot`, the accompanying screenshot remains
  viewport-only. Existing-session/chrome-mcp profiles render overlay labels on
  page screenshots but do not return `annotations` or use the Playwright
  full-page/ref/element projection helper. Without Playwright or chrome-mcp,
  labeled screenshots are not available.
- `--urls` appends discovered link destinations to AI snapshots.

## Snapshots and refs

Quiet Core bot supports two "snapshot" styles:

- **AI snapshot (numeric refs)**: `quiet-core-bot browser snapshot` (default; `--format ai`)
  - Output: a text snapshot that includes numeric refs.
  - Actions: `quiet-core-bot browser click 12`, `quiet-core-bot browser type 23 "hello"`.
  - Internally, the ref is resolved via Playwright's `aria-ref`.

- **Role snapshot (role refs like `e12`)**: `quiet-core-bot browser snapshot --interactive` (or `--compact`, `--depth`, `--selector`, `--frame`)
  - Output: a role-based list/tree with `[ref=e12]` (and optional `[nth=1]`).
  - Actions: `quiet-core-bot browser click e12`, `quiet-core-bot browser highlight e12`.
  - Internally, the ref is resolved via `getByRole(...)` (plus `nth()` for duplicates).
  - Add `--labels` to include a screenshot with overlayed `e12` labels. On
    Playwright-backed profiles this also returns per-ref bounding-box metadata
    (`annotations[]`).
  - Add `--urls` when link text is ambiguous and the agent needs concrete
    navigation targets.

- **ARIA snapshot (ARIA refs like `ax12`)**: `quiet-core-bot browser snapshot --format aria`
  - Output: the accessibility tree as structured nodes.
  - Actions: `quiet-core-bot browser click ax12` works when the snapshot path can bind
    the ref through Playwright and Chrome backend DOM ids.
- If Playwright is unavailable, ARIA snapshots can still be useful for
  inspection, but refs may not be actionable. Re-snapshot with `--format ai`
  or `--interactive` when you need action refs.
- Docker proof for the raw-CDP fallback path: `pnpm test:docker:browser-cdp-snapshot`
  starts Chromium with CDP, runs `browser doctor --deep`, and verifies role
  snapshots include link URLs, cursor-promoted clickables, and iframe metadata.

Ref behavior:

- Refs are **not stable across navigations**; if something fails, re-run `snapshot` and use a fresh ref.
- `/act` returns the current raw `targetId` after action-triggered replacement
  when it can prove the replacement tab. Keep using stable tab ids/labels for
  follow-up commands.
- If the role snapshot was taken with `--frame`, role refs are scoped to that iframe until the next role snapshot.
- Unknown or stale `axN` refs fail fast instead of falling through to
  Playwright's `aria-ref` selector. Run a fresh snapshot on the same tab when
  that happens.

## Wait power-ups

You can wait on more than just time/text:

- Wait for URL (globs supported by Playwright):
  - `quiet-core-bot browser wait --url "**/dash"`
- Wait for load state:
  - `quiet-core-bot browser wait --load networkidle`
  - Supported on managed `quiet-core-bot` and raw/remote CDP profiles. The `user` and `existing-session` profiles reject `networkidle`; use `--url`, `--text`, a selector, or `--fn` waits there.
- Wait for a JS predicate:
  - `quiet-core-bot browser wait --fn "window.ready===true"`
- Wait for a selector to become visible:
  - `quiet-core-bot browser wait "#main"`

These can be combined:

```bash
quiet-core-bot browser wait "#main" \
  --url "**/dash" \
  --load networkidle \
  --fn "window.ready===true" \
  --timeout-ms 15000
```

## Debug workflows

When an action fails (e.g. "not visible", "strict mode violation", "covered"):

1. `quiet-core-bot browser snapshot --interactive`
2. Use `click <ref>` / `type <ref>` (prefer role refs in interactive mode)
3. If it still fails: `quiet-core-bot browser highlight <ref>` to see what Playwright is targeting
4. If the page behaves oddly:
   - `quiet-core-bot browser errors --clear`
   - `quiet-core-bot browser requests --filter api --clear`
5. For deep debugging: record a trace:
   - `quiet-core-bot browser trace start`
   - reproduce the issue
   - `quiet-core-bot browser trace stop` (prints `TRACE:<path>`)

## JSON output

`--json` is for scripting and structured tooling.

Examples:

```bash
quiet-core-bot browser status --json
quiet-core-bot browser snapshot --interactive --json
quiet-core-bot browser requests --filter api --json
quiet-core-bot browser cookies --json
```

Role snapshots in JSON include `refs` plus a small `stats` block (lines/chars/refs/interactive) so tools can reason about payload size and density.

## State and environment knobs

These are useful for "make the site behave like X" workflows:

- Cookies: `cookies`, `cookies set`, `cookies clear`
- Storage: `storage local|session get|set|clear`
- Offline: `set offline on|off`
- Headers: `set headers --headers-json '{"X-Debug":"1"}'` (legacy `set headers --json '{"X-Debug":"1"}'` remains supported)
- HTTP basic auth: `set credentials user pass` (or `--clear`)
- Geolocation: `set geo <lat> <lon> --origin "https://example.com"` (or `--clear`)
- Media: `set media dark|light|no-preference|none`
- Timezone / locale: `set timezone ...`, `set locale ...`
- Device / viewport:
  - `set device "iPhone 14"` (Playwright device presets)
  - `set viewport 1280 720`

## Security and privacy

- The quiet-core-bot browser profile may contain logged-in sessions; treat it as sensitive.
- `browser act kind=evaluate` / `quiet-core-bot browser evaluate` and `wait --fn`
  execute arbitrary JavaScript in the page context. Prompt injection can steer
  this. Disable it with `browser.evaluateEnabled=false` if you do not need it.
- `quiet-core-bot browser evaluate --fn` accepts a function source, an expression, or
  a statement body. Statement bodies are wrapped as async functions, so use
  `return` for the value you want back. Use `--timeout-ms <ms>` when the
  page-side function may need longer than the default evaluate timeout.
- For logins and anti-bot notes (X/Twitter, etc.), see [Browser login + X/Twitter posting](/tools/browser-login).
- Keep the Gateway/node host private (loopback or tailnet-only).
- Remote CDP endpoints are powerful; tunnel and protect them.

Strict-mode example (block private/internal destinations by default):

```json5
{
  browser: {
    ssrfPolicy: {
      dangerouslyAllowPrivateNetwork: false,
      hostnameAllowlist: ["*.example.com", "example.com"],
      allowedHostnames: ["localhost"], // optional exact allow
    },
  },
}
```

## Related

- [Browser](/tools/browser) - overview, configuration, profiles, security
- [Browser login](/tools/browser-login) - signing in to sites
- [Browser Linux troubleshooting](/tools/browser-linux-troubleshooting)
- [Browser WSL2 troubleshooting](/tools/browser-wsl2-windows-remote-cdp-troubleshooting)
