---
summary: "Runbook for the Gateway service, lifecycle, and operations"
read_when:
  - Running or debugging the gateway process
title: "Gateway runbook"
---

Use this page for day-1 startup and day-2 operations of the Gateway service.

<CardGroup cols={2}>
  <Card title="Deep troubleshooting" icon="siren" href="/gateway/troubleshooting">
    Symptom-first diagnostics with exact command ladders and log signatures.
  </Card>
  <Card title="Configuration" icon="sliders" href="/gateway/configuration">
    Task-oriented setup guide + full configuration reference.
  </Card>
  <Card title="Secrets management" icon="key-round" href="/gateway/secrets">
    SecretRef contract, runtime snapshot behavior, and migrate/reload operations.
  </Card>
  <Card title="Secrets plan contract" icon="shield-check" href="/gateway/secrets-plan-contract">
    Exact `secrets apply` target/path rules and ref-only auth-profile behavior.
  </Card>
</CardGroup>

## 5-minute local startup

<Steps>
  <Step title="Start the Gateway">

```bash
quiet-core-bot gateway --port 18789
# debug/trace mirrored to stdio
quiet-core-bot gateway --port 18789 --verbose
# force-kill listener on selected port, then start
quiet-core-bot gateway --force
```

  </Step>

  <Step title="Verify service health">

```bash
quiet-core-bot gateway status
quiet-core-bot status
quiet-core-bot logs --follow
```

Healthy baseline: `Runtime: running`, `Connectivity probe: ok`, and `Capability: ...` that matches what you expect. Use `quiet-core-bot gateway status --require-rpc` when you need read-scope RPC proof, not just reachability.

  </Step>

  <Step title="Validate channel readiness">

```bash
quiet-core-bot channels status --probe
```

With a reachable gateway this runs live per-account channel probes and optional audits.
If the gateway is unreachable, the CLI falls back to config-only channel summaries instead
of live probe output.

  </Step>
</Steps>

<Note>
Gateway config reload watches the active config file path (resolved from profile/state defaults, or `QUIET_CORE_CONFIG_PATH` when set).
Default mode is `gateway.reload.mode="hybrid"`.
After the first successful load, the running process serves the active in-memory config snapshot; successful reload swaps that snapshot atomically.
</Note>

## Runtime model

- One always-on process for routing, control plane, and channel connections.
- Single multiplexed port for:
  - WebSocket control/RPC
  - HTTP APIs (`/v1/models`, `/v1/embeddings`, `/v1/chat/completions`, `/v1/responses`, `/tools/invoke`)
  - Plugin HTTP routes, such as optional `/api/v1/admin/rpc`
  - Control UI and hooks
- Default bind mode: `loopback`.
- Auth is required by default. Shared-secret setups use
  `gateway.auth.token` / `gateway.auth.password` (or
  `QUIET_CORE_GATEWAY_TOKEN` / `QUIET_CORE_GATEWAY_PASSWORD`), and non-loopback
  reverse-proxy setups can use `gateway.auth.mode: "trusted-proxy"`.

## OpenAI-compatible endpoints

Quiet Core bot's highest-leverage compatibility surface is now:

- `GET /v1/models`
- `GET /v1/models/{id}`
- `POST /v1/embeddings`
- `POST /v1/chat/completions`
- `POST /v1/responses`

Why this set matters:

- Most Open WebUI, LobeChat, and LibreChat integrations probe `/v1/models` first.
- Many RAG and memory pipelines expect `/v1/embeddings`.
- Agent-native clients increasingly prefer `/v1/responses`.

Planning note:

- `/v1/models` is agent-first: it returns `quiet-core-bot`, `quiet-core-bot/default`, and `quiet-core-bot/<agentId>`.
- `quiet-core-bot/default` is the stable alias that always maps to the configured default agent.
- Use `x-quiet-core-bot-model` when you want a backend provider/model override; otherwise the selected agent's normal model and embedding setup stays in control.

All of these run on the main Gateway port and use the same trusted operator auth boundary as the rest of the Gateway HTTP API.

Admin HTTP RPC (`POST /api/v1/admin/rpc`) is a separate, default-off plugin route for host tooling that cannot use WebSocket RPC. See [Admin HTTP RPC](/plugins/admin-http-rpc).

### Port and bind precedence

| Setting      | Resolution order                                              |
| ------------ | ------------------------------------------------------------- |
| Gateway port | `--port` → `QUIET_CORE_GATEWAY_PORT` → `gateway.port` → `18789` |
| Bind mode    | CLI/override → `gateway.bind` → `loopback`                    |

Installed gateway services record the resolved `--port` in supervisor metadata. After changing `gateway.port`, run `quiet-core-bot doctor --fix` or `quiet-core-bot gateway install --force` so launchd/systemd/schtasks starts the process on the new port.

Gateway startup uses the same effective port and bind when it seeds local
Control UI origins for non-loopback binds. For example, `--bind lan --port 3000`
seeds `http://localhost:3000` and `http://127.0.0.1:3000` before runtime
validation runs. Add any remote browser origins, such as HTTPS proxy URLs, to
`gateway.controlUi.allowedOrigins` explicitly.

### Hot reload modes

| `gateway.reload.mode` | Behavior                                   |
| --------------------- | ------------------------------------------ |
| `off`                 | No config reload                           |
| `hot`                 | Apply only hot-safe changes                |
| `restart`             | Restart on reload-required changes         |
| `hybrid` (default)    | Hot-apply when safe, restart when required |

## Operator command set

```bash
quiet-core-bot gateway status
quiet-core-bot gateway status --deep   # adds a system-level service scan
quiet-core-bot gateway status --json
quiet-core-bot gateway install
quiet-core-bot gateway restart
quiet-core-bot gateway restart --safe   # drain active work before restarting
quiet-core-bot gateway stop
quiet-core-bot secrets reload
quiet-core-bot logs --follow
quiet-core-bot doctor
```

`gateway status --deep` is for extra service discovery (LaunchDaemons/systemd system
units/schtasks), not a deeper RPC health probe.

Use `quiet-core-bot gateway restart --safe` for routine restarts: it asks the running gateway to
preflight active Quiet Core bot work, reports the blockers, coalesces duplicate requests, and restarts
once queued operations, reply delivery, embedded runs, and task runs have drained. Plain
`quiet-core-bot gateway restart` keeps the service-manager behavior for compatibility, and `--force`
skips the drain entirely.

## Multiple gateways (same host)

Most installs should run one gateway per machine. A single gateway can host multiple
agents and channels.

You only need multiple gateways when you intentionally want isolation or a rescue bot.

Useful checks:

```bash
quiet-core-bot gateway status --deep
quiet-core-bot gateway probe
```

What to expect:

- `gateway status --deep` can report `Other gateway-like services detected (best effort)`
  and print cleanup hints when stale launchd/systemd/schtasks installs are still around.
- `gateway probe` can warn about `multiple reachable gateway identities` when distinct
  gateways answer, or when Quiet Core bot cannot prove reachable targets are the same gateway.
  An SSH tunnel, proxy URL, or configured remote URL to the same gateway is one
  gateway with multiple transports, even when transport ports differ.
- If that is intentional, isolate ports, config/state, and workspace roots per gateway.

Checklist per instance:

- Unique `gateway.port`
- Unique `QUIET_CORE_CONFIG_PATH`
- Unique `QUIET_CORE_STATE_DIR`
- Unique `agents.defaults.workspace`

Example:

```bash
QUIET_CORE_CONFIG_PATH=~/.quiet-core-bot/a.json QUIET_CORE_STATE_DIR=~/.quiet-core-bot-a quiet-core-bot gateway --port 19001
QUIET_CORE_CONFIG_PATH=~/.quiet-core-bot/b.json QUIET_CORE_STATE_DIR=~/.quiet-core-bot-b quiet-core-bot gateway --port 19002
```

Detailed setup: [/gateway/multiple-gateways](/gateway/multiple-gateways).

## Remote access

Preferred: Tailscale/VPN.
Fallback: SSH tunnel.

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

Then connect clients locally to `ws://127.0.0.1:18789`.

<Warning>
SSH tunnels do not bypass gateway auth. For shared-secret auth, clients still
must send `token`/`password` even over the tunnel. For identity-bearing modes,
the request still has to satisfy that auth path.
</Warning>

See: [Remote Gateway](/gateway/remote), [Authentication](/gateway/authentication), [Tailscale](/gateway/tailscale).

## Supervision and service lifecycle

Use supervised runs for production-like reliability.

<Tabs>
  <Tab title="macOS (launchd)">

```bash
quiet-core-bot gateway install
quiet-core-bot gateway status
quiet-core-bot gateway restart
quiet-core-bot gateway stop
```

Use `quiet-core-bot gateway restart` for restarts. Do not chain `quiet-core-bot gateway stop` and `quiet-core-bot gateway start` as a restart substitute.

When the gateway may be mid-work (queued operations, reply delivery, embedded runs, task runs), prefer `quiet-core-bot gateway restart --safe`. The gateway then drains that work before it stops, instead of interrupting in-flight runs; use plain `gateway restart` only when the service manager's immediate behavior is what you want.

On macOS, `gateway stop` uses `launchctl bootout` by default — this removes the LaunchAgent from the current boot session without persisting a disable, so KeepAlive auto-recovery still works after unexpected crashes and `gateway start` re-enables cleanly. To persistently suppress auto-respawn across reboots, pass `--disable`: `quiet-core-bot gateway stop --disable`.

LaunchAgent labels are `ai.quiet-core-bot.gateway` (default) or `ai.quiet-core-bot.<profile>` (named profile). `quiet-core-bot doctor` audits and repairs service config drift.

  </Tab>

  <Tab title="Linux (systemd user)">

```bash
quiet-core-bot gateway install
systemctl --user enable --now quiet-core-bot-gateway[-<profile>].service
quiet-core-bot gateway status
```

For persistence after logout, enable lingering:

```bash
sudo loginctl enable-linger <user>
```

Manual user-unit example when you need a custom install path:

```ini
[Unit]
Description=Quiet Core bot Gateway
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/quiet-core-bot gateway --port 18789
Restart=always
RestartSec=5
TimeoutStopSec=30
TimeoutStartSec=30
SuccessExitStatus=0 143
OOMPolicy=continue
KillMode=control-group

[Install]
WantedBy=default.target
```

  </Tab>

  <Tab title="Windows (native)">

```powershell
quiet-core-bot gateway install
quiet-core-bot gateway status --json
quiet-core-bot gateway restart
quiet-core-bot gateway stop
```

Native Windows managed startup uses a Scheduled Task named `Quiet Core bot Gateway`
(or `Quiet Core bot Gateway (<profile>)` for named profiles). If Scheduled Task
creation is denied, Quiet Core bot falls back to a per-user Startup-folder launcher
that points at `gateway.cmd` inside the state directory.

  </Tab>

  <Tab title="Linux (system service)">

Use a system unit for multi-user/always-on hosts.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now quiet-core-bot-gateway[-<profile>].service
```

Use the same service body as the user unit, but install it under
`/etc/systemd/system/quiet-core-bot-gateway[-<profile>].service` and adjust
`ExecStart=` if your `quiet-core-bot` binary lives elsewhere.

Do not also let `quiet-core-bot doctor --fix` install a user-level gateway service for the same profile/port. Doctor refuses that automatic install when it finds a system-level Quiet Core bot gateway service; use `QUIET_CORE_SERVICE_REPAIR_POLICY=external` when the system unit owns the lifecycle.

  </Tab>
</Tabs>

## Interrupted main sessions and restart recovery

> **Delivery wording (adopted, A4).** Keep this statement verbatim in delivery
> claims and release notes:
>
> - The run ledger does **not** auto-recover anything — it only records the
>   interrupted run (`status='interrupted'`, `ended_reason='gateway restart'`).
> - A main session is continued by `main-session-restart-recovery` after the next
>   gateway start (when its persisted transcript is resumable; subagent/cron/ACP
>   sessions are skipped).
> - A CLI-dispatched long task may **re-run its whole turn** — including already
>   completed side effects — when the gateway is interrupted mid-turn (the CLI's
>   embedded-fallback path, see below).

Quiet Core bot has **two different layers** here, and they do not make the same promise.
State this distinction explicitly in any delivery claim (A4 / R8-B2):

| Layer                                                | What it guarantees                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent_runs` ledger (`agent_runs` table)             | The interrupted run is recorded as `status='interrupted'`, `ended_reason='gateway restart'`. The ledger itself has **no** resume, replay, or checkpoint path — nothing in it ever re-runs the interrupted run.                           |
| `main-session-restart-recovery` (main sessions only) | The **session** is resumed: after a gateway restart, an interrupted main session whose transcript is still on disk is marked and the agent re-enters the session to finish the interrupted turn. Subagent/cron/ACP sessions are skipped. |

### Trigger conditions

Recovery only resumes a session when **all** of the following hold:

1. The session is a main session (not subagent, cron, or ACP).
2. The session entry is `status='running'` with `abortedLastRun=true`, or a stale
   transcript lock was left behind by the killed process.
3. The persisted transcript tail is **resumable**: the last meaningful message is a
   `user`, `tool`, or `toolResult` message. A tail ending in an assistant tool call
   with no result, or a stale `approval-pending` tool result, is **not** resumable —
   the session is marked failed and no resume happens.
4. No other process currently owns the session.

If the killed run never flushed its transcript (a very early kill), there is no
stale lock and no transcript tail: recovery never fires, and only the ledger row
records the interruption. That is why the same mechanism can look "always failing",
"never firing", or "successfully resumed" depending on kill timing.

### Side effects and replay risk

- The resumed turn is injected as a `[System] Your previous turn was interrupted by
a gateway restart …` message and continues **from the persisted transcript**.
  Tool calls that already have a result in the transcript are history, not pending
  work, so they are **not re-executed** by the resume itself (the resume condition in
  §Trigger conditions requires the tail to already carry a tool result).
- The transcript was already flushed, so any `write` / `exec` that completed before
  the kill has already happened on disk. Recovery does not undo or repeat it.
- A tool call that was in flight _without_ a persisted result blocks recovery
  (condition 3), so it is never silently replayed either.
- Recovery sends one `agent` request with a fresh `idempotencyKey`; retries within
  the same gateway process are deduplicated per `sessionKey`.

> **Side-effect replay risk outside the recovery path.** The statements above cover
> `main-session-restart-recovery`. They do **not** cover the CLI's embedded fallback:
> when a CLI-dispatched `agent` command loses its gateway mid-turn it first emits an
> explicit pre-fallback warning — `[cli-fallback] Gateway unavailable; falling back to
an embedded in-process whole-turn rerun for runId=…` followed by `This will re-run
the ENTIRE turn inside the CLI process; tool side effects that already executed
against the gateway may be REPLAYED …` (the `gateway_timeout` variant says
> `Gateway timed out` and announces a fresh `gateway-fallback-*` session instead of a
> rerun) — and then prints `EMBEDDED FALLBACK: Gateway agent failed; running embedded
agent` and re-runs the whole turn locally. That second in-process run starts from the transcript and can
> therefore **re-execute already completed tool calls** (measured: one `write` call
> executed twice in the same session transcript, ≈39 s apart, under a separate
> `agent_runs` row owned by the CLI process). While that fallback run is alive it also
> holds the transcript lock, so the gateway-side recovery resume can fail with
> `SessionWriteLockTimeoutError`. Only treat CLI-dispatched long runs as "at-most-once
> side effects" while the gateway stays up.
>
> The fallback is recorded so it can be observed and attributed even though the
> gateway is unreachable at that moment: the CLI writes one row per invocation into
> the shared local state DB with scope `cli_embedded_fallback`, keyed by the CLI
> dispatch run id, e.g.
>
> ```json
> {
>   "scope": "cli_embedded_fallback",
>   "event_key": "<cli dispatch runId>",
>   "payload": {
>     "reason": "gateway_failure",
>     "sessionKey": "agent:main:…",
>     "pid": 19648,
>     "gatewayError": "GatewayTransportError: gateway closed (1006 …)",
>     "replayRisk": "whole_turn_rerun"
>   }
> }
> ```
>
> `reason` is `gateway_failure` or `gateway_timeout` (the timeout variant reports the
> fresh `gateway-fallback-*` session it created as `sessionId`/`fallbackRunId`).
> Treat any row for a session you also see in `agent_runs` as a candidate replay.

### Ledger shape after a resumed interruption

A resumed interruption leaves **two rows** in `agent_runs` for the same
`session_key`, which is intentional and machine-joinable:

| Row             | `status`      | `ended_reason`    | Notes                                           |
| --------------- | ------------- | ----------------- | ----------------------------------------------- |
| Interrupted run | `interrupted` | `gateway restart` | `owner_pid` = the killed gateway                |
| Resumed run     | `ok`          | `run_completed`   | `started_at` ≈ the interrupted row's `ended_at` |

The gateway log line carries both ids so the pair can be joined without guessing:

```text
resumed interrupted main session: <sessionKey> eventType=main-session-restart-recovery.resumed \
  interruptedRunIds=<old runId> resumedRunId=<new runId>
```

Treat this as "one interrupted turn, completed once" — not as a duplicate
execution. The session entry (`restartRecoveryRuns`) keeps the interrupted run ids
until the resume clears `abortedLastRun`.

### Terminal ledger writes are compensated, not dropped

A run's terminal write (`ok` / `failed` / `timeout` / `interrupted`) can lose a race
with a SQLite `EXCLUSIVE` lock. Rather than leaving the row `running` forever, the
write is queued for compensation and replayed on a bounded exponential backoff
(1s base, doubling, capped at 30s), and the queue is mirrored to
`<state dir>/agent-runs-pending-terminal-writes.json` so a crash window cannot lose
it. A restart replays the queue before the startup sweep, so a run whose terminal
write failed is finalized with its real outcome instead of being swept as
`interrupted`. The first terminal decision wins: the write is guarded on
`status = 'running'`, so a replay can never overwrite a later outcome. Log lines:

```text
agent run ledger end write queued for compensation: runId=<runId> status=<status>
agent run ledger end write compensated after <n> attempt(s): runId=<runId> status=<status>
```

## Dev profile quick path

```bash
quiet-core-bot --dev setup
quiet-core-bot --dev gateway --allow-unconfigured
quiet-core-bot --dev status
```

Defaults include isolated state/config and base gateway port `19001`.

## Protocol quick reference (operator view)

- First client frame must be `connect`.
- Gateway returns `hello-ok` snapshot (`presence`, `health`, `stateVersion`, `uptimeMs`, limits/policy).
- `hello-ok.features.methods` / `events` are a conservative discovery list, not
  a generated dump of every callable helper route.
- Requests: `req(method, params)` → `res(ok/payload|error)`.
- Common events include `connect.challenge`, `agent`, `chat`,
  `session.message`, `session.operation`, `session.tool`, `sessions.changed`,
  `presence`, `tick`, `health`, `heartbeat`, pairing/approval lifecycle events,
  and `shutdown`.

Agent runs are two-stage:

1. Immediate accepted ack (`status:"accepted"`)
2. Final completion response (`status:"ok"|"error"`), with streamed `agent` events in between.

See full protocol docs: [Gateway Protocol](/gateway/protocol).

## Operational checks

### Liveness

- Open WS and send `connect`.
- Expect `hello-ok` response with snapshot.

#### Stalled-run watchdog floor (A13)

The session-liveness watchdog aborts a model call that stops reporting progress. Its default abort
threshold is **derived**, not fixed:

```
abortMs = max(5 min, 3 × stuckSessionWarnMs, maxConfiguredProviderRequestTimeoutMs)
```

`stuckSessionWarnMs` defaults to 120s, so an **unconfigured** deployment keeps the ~360s floor
(3 × 120s > the 5-minute minimum). When `models.providers.<id>.timeoutSeconds` is set, the floor is
raised to the **largest configured provider request timeout**, because a provider request timeout is
the transport layer's own bound on one model call and the watchdog must never fire before it can
(`resolveStuckSessionAbortMs` / `resolveMaxConfiguredProviderRequestTimeoutMs` in
`src/logging/diagnostic.ts`).

Leaving unconfigured deployments at ~360s is **deliberate**: deriving a floor from a provider
timeout that was never configured would change watchdog behaviour for every deployment that does not
use that knob, including ones whose bottleneck is neither the transport nor a local model. So:

- Slow local/self-hosted model (long first-token wait)? Configure
  `models.providers.<id>.timeoutSeconds`; the watchdog floor follows it automatically.
- Need an explicit budget? `diagnostics.stuckSessionAbortMs` is authoritative and is never lowered
  (it is kept at least as high as `stuckSessionWarnMs`), and it is not clamped by the provider
  values.

### Readiness

```bash
quiet-core-bot gateway status
quiet-core-bot channels status --probe
quiet-core-bot health
```

### Event-loop degradation is a capacity signal, not a readiness failure

`/readyz` (and `/ready`) answers exactly one question: can this gateway serve traffic? Event-loop
pressure never changes that answer. A gateway can report `ready: true` while `eventLoop.degraded`
is `true`; that combination means "traffic can be served, but headroom is thin".

- `ready` = channel/startup/drain gating only (`src/gateway/server/readiness.ts`). It is not a
  capacity gate.
- `eventLoop.degraded` = the sampled event-loop delay / utilization / CPU counters for this gateway
  crossed their warning bands. Reasons are `event_loop_delay`, `event_loop_utilization`, `cpu`.
  `event_loop_delay` degrades on a single sample (p99 or max >= 1000ms); the load reasons
  (`event_loop_utilization` >= 0.95, `cpu` >= 0.9 core) additionally require a >= 1000ms sample
  window with >= 25ms delay co-evidence, so short async bursts do not flap the signal.

Read it as a capacity signal, not as a liveness/readiness failure:

| Surface                                                 | What it shows                                                                                                                                                                                                              | Who can read it             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Gateway log (stderr / log file), subsystem `event-loop` | `event-loop degraded (capacity signal only; /readyz readiness is unaffected): reasons=… p99Ms=… maxMs=… utilization=… cpuCoreRatio=… intervalMs=…`, and `event-loop recovered (capacity signal cleared): …` when it clears | any log collector           |
| `GET /readyz`                                           | `{ ready, failing, uptimeMs, eventLoop }` for loopback direct callers or callers that prove gateway auth; `{ ready }` only for unauthenticated remote probes                                                               | operator / authorized probe |
| `quiet-core-bot status`                                 | `Gateway event loop` row: `OK` / `WARN` plus reasons, `max`, `p99`, `util`, `cpu`                                                                                                                                          | local operator              |
| `quiet-core-bot channels status`                        | `Gateway event loop degraded: reasons=… eventLoopDelayMaxMs=… eventLoopUtilization=… cpuCoreRatio=…`                                                                                                                       | local operator              |
| `health` RPC / `quiet-core-bot health`                  | `eventLoop` object in the health summary                                                                                                                                                                                   | local operator              |

Suggested orchestration split:

- Route traffic on `ready` only. Do **not** fail over because `eventLoop.degraded` flipped; the
  gateway still serves requests.
- Alert (and shed load, throttle schedules, or scale out) on `eventLoop.degraded`, either by
  scraping the `event-loop` log transition lines or by reading `eventLoop` from an authorized
  `/readyz`. The alert must be a _capacity_ alert with a separate threshold from your readiness
  alert; both can be true at the same time.

The transition log fires once per flip (not per sample), so it is safe to alert on directly.

### Gap recovery

Events are not replayed. On sequence gaps, refresh state (`health`, `system-presence`) before continuing.

## Common failure signatures

| Signature                                                      | Likely issue                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `refusing to bind gateway ... without auth`                    | Non-loopback bind without a valid gateway auth path                             |
| `another gateway instance is already listening` / `EADDRINUSE` | Port conflict                                                                   |
| `Gateway start blocked: set gateway.mode=local`                | Config set to remote mode, or local-mode stamp is missing from a damaged config |
| `unauthorized` during connect                                  | Auth mismatch between client and gateway                                        |

For full diagnosis ladders, use [Gateway Troubleshooting](/gateway/troubleshooting).

## Safety guarantees

- Gateway protocol clients fail fast when Gateway is unavailable (no implicit direct-channel fallback).
- Invalid/non-connect first frames are rejected and closed.
- Graceful shutdown emits `shutdown` event before socket close.

---

Related:

- [Troubleshooting](/gateway/troubleshooting)
- [Background Process](/gateway/background-process)
- [Configuration](/gateway/configuration)
- [Health](/gateway/health)
- [Doctor](/gateway/doctor)
- [Authentication](/gateway/authentication)

## Related

- [Configuration](/gateway/configuration)
- [Gateway troubleshooting](/gateway/troubleshooting)
- [Remote access](/gateway/remote)
- [Secrets management](/gateway/secrets)
