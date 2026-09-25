---
summary: "Deep dive: session store + transcripts, lifecycle, and (auto)compaction internals"
read_when:
  - You need to debug session ids, transcript JSONL, or sessions.json fields
  - You are changing auto-compaction behavior or adding "pre-compaction" housekeeping
  - You want to implement memory flushes or silent system turns
title: "Session management deep dive"
---

Quiet Core bot manages sessions end-to-end across these areas:

- **Session routing** (how inbound messages map to a `sessionKey`)
- **Session store** (`sessions.json`) and what it tracks
- **Transcript persistence** (`*.jsonl`) and its structure
- **Transcript hygiene** (provider-specific fixups before runs)
- **Context limits** (context window vs tracked tokens)
- **Compaction** (manual and auto-compaction) and where to hook pre-compaction work
- **Silent housekeeping** (memory writes that should not produce user-visible output)

If you want a higher-level overview first, start with:

- [Session management](/concepts/session)
- [Compaction](/concepts/compaction)
- [Memory overview](/concepts/memory)
- [Memory search](/concepts/memory-search)
- [Session pruning](/concepts/session-pruning)
- [Transcript hygiene](/reference/transcript-hygiene)

---

## Source of truth: the Gateway

Quiet Core bot is designed around a single **Gateway process** that owns session state.

- UIs (macOS app, web Control UI, TUI) should query the Gateway for session lists and token counts.
- In remote mode, session files are on the remote host; "checking your local Mac files" won't reflect what the Gateway is using.

---

## Two persistence layers

Quiet Core bot persists sessions in two layers:

1. **Session store (`sessions.json`)**
   - Key/value map: `sessionKey -> SessionEntry`
   - Small, mutable, safe to edit (or delete entries)
   - Tracks session metadata (current session id, last activity, toggles, token counters, etc.)

2. **Transcript (`<sessionId>.jsonl`)**
   - Append-only transcript with tree structure (entries have `id` + `parentId`)
   - Stores the actual conversation + tool calls + compaction summaries
   - Used to rebuild the model context for future turns
   - Compaction checkpoints are metadata over the compacted successor
     transcript. New compactions do not write a second `.checkpoint.*.jsonl`
     copy.

Gateway history readers should avoid materializing the whole transcript unless
the surface explicitly needs arbitrary historical access. First-page history,
embedded chat history, restart recovery, and token/usage checks use bounded tail
reads. Full transcript scans go through the async transcript index, which is
cached by file path plus `mtimeMs`/`size` and shared across concurrent readers.

---

## On-disk locations

Per agent, on the Gateway host:

- Store: `~/.quiet-core-bot/agents/<agentId>/sessions/sessions.json`
- Transcripts: `~/.quiet-core-bot/agents/<agentId>/sessions/<sessionId>.jsonl`
  - Telegram topic sessions: `.../<sessionId>-topic-<threadId>.jsonl`

Quiet Core bot resolves these via `src/config/sessions.ts`.

---

## Store maintenance and disk controls

Session persistence has automatic maintenance controls (`session.maintenance`) for `sessions.json`, transcript artifacts, and trajectory sidecars:

- `mode`: `enforce` (default) or `warn`
- `pruneAfter`: stale-entry age cutoff (default `30d`)
- `maxEntries`: cap entries in `sessions.json` (default `500`)
- `resetArchiveRetention`: retention for `*.reset.<timestamp>` transcript archives (default: same as `pruneAfter`; `false` disables cleanup)
- `maxDiskBytes`: optional sessions-directory budget
- `highWaterBytes`: optional target after cleanup (default `80%` of `maxDiskBytes`)

Normal Gateway writes flow through a per-store session writer that serializes in-process mutations without taking a runtime file lock. Hot-path patch helpers borrow the validated mutable cache while they hold that writer slot, so large `sessions.json` files are not cloned or reread for every metadata update. Runtime code should prefer `updateSessionStore(...)` or `updateSessionStoreEntry(...)`; direct whole-store saves are compatibility and offline-maintenance tools. When a Gateway is reachable, non-dry-run `quiet-core-bot sessions cleanup` and `quiet-core-bot agents delete` delegate store mutations to the Gateway so cleanup joins the same writer queue; `--store <path>` is the explicit offline repair path for direct file maintenance. `maxEntries` cleanup is still batched for production-sized caps, so a store may briefly exceed the configured cap before the next high-water cleanup rewrites it back down. Session store reads do not prune or cap entries during Gateway startup; use writes or `quiet-core-bot sessions cleanup --enforce` for cleanup. `quiet-core-bot sessions cleanup --enforce` still applies the configured cap immediately and prunes old unreferenced transcript, checkpoint, and trajectory artifacts even when no disk budget is configured.

Maintenance keeps durable external conversation pointers such as group sessions
and thread-scoped chat sessions, but synthetic runtime entries for cron, hooks,
heartbeat, ACP, and sub-agents can still be removed when they exceed the
configured age, count, or disk budget.

Quiet Core bot no longer creates automatic `sessions.json.bak.*` rotation backups during Gateway writes. The legacy `session.maintenance.rotateBytes` key is ignored and `quiet-core-bot doctor --fix` removes it from older configs.

Transcript mutations use a session write lock on the transcript file. Lock acquisition waits up to
`session.writeLock.acquireTimeoutMs` before surfacing a busy-session error; the default is `60000`
ms. Raise this only when legitimate prep, cleanup, compaction, or transcript mirror work contends
longer on slow machines. `session.writeLock.staleMs` controls when an existing lock can be
reclaimed as stale; the default is `1800000` ms. `session.writeLock.maxHoldMs` controls the
in-process watchdog release threshold; the default is `300000` ms. Emergency env overrides are
`OPENCLAW_SESSION_WRITE_LOCK_ACQUIRE_TIMEOUT_MS`, `OPENCLAW_SESSION_WRITE_LOCK_STALE_MS`, and
`OPENCLAW_SESSION_WRITE_LOCK_MAX_HOLD_MS`.

Enforcement order for disk budget cleanup (`mode: "enforce"`):

1. Remove oldest archived, orphan transcript, or orphan trajectory artifacts first.
2. If still above the target, evict oldest session entries and their transcript/trajectory files.
3. Keep going until usage is at or below `highWaterBytes`.

In `mode: "warn"`, Quiet Core bot reports potential evictions but does not mutate the store/files.

Run maintenance on demand:

```bash
quiet-core-bot sessions cleanup --dry-run
quiet-core-bot sessions cleanup --enforce
```

---

## Cron sessions and run logs

Isolated cron runs also create session entries/transcripts, and they have dedicated retention controls:

- `cron.sessionRetention` (default `24h`) prunes old isolated cron run sessions from the session store (`false` disables).
- `cron.runLog.keepLines` prunes retained SQLite run-history rows per cron job (default: `2000`). `cron.runLog.maxBytes` remains accepted for older file-backed run logs.

When cron force-creates a new isolated run session, it sanitizes the previous
`cron:<jobId>` session entry before writing the new row. It carries safe
preferences such as thinking/fast/verbose settings, labels, and explicit
user-selected model/auth overrides. It drops ambient conversation context such
as channel/group routing, send or queue policy, elevation, origin, and ACP
runtime binding so a fresh isolated run cannot inherit stale delivery or
runtime authority from an older run.

---

## Session keys (`sessionKey`)

A `sessionKey` identifies _which conversation bucket_ you're in (routing + isolation).

Common patterns:

- Main/direct chat (per agent): `agent:<agentId>:<mainKey>` (default `main`)
- Group: `agent:<agentId>:<channel>:group:<id>`
- Room/channel (Discord/Slack): `agent:<agentId>:<channel>:channel:<id>` or `...:room:<id>`
- Cron: `cron:<job.id>`
- Webhook: `hook:<uuid>` (unless overridden)

The canonical rules are documented at [/concepts/session](/concepts/session).

---

## Session ids (`sessionId`)

Each `sessionKey` points at a current `sessionId` (the transcript file that continues the conversation).

Rules of thumb:

- **Reset** (`/new`, `/reset`) creates a new `sessionId` for that `sessionKey`.
- **Daily reset** (default 4:00 AM local time on the gateway host) creates a new `sessionId` on the next message after the reset boundary.
- **Idle expiry** (`session.reset.idleMinutes` or legacy `session.idleMinutes`) creates a new `sessionId` when a message arrives after the idle window. When daily + idle are both configured, whichever expires first wins.
- **Control UI reconnect resume** can preserve the currently visible session for one reconnect send when the Gateway receives the matching `sessionId` from an operator UI client. Ordinary stale sends still create a new `sessionId`.
- **System events** (heartbeat, cron wakeups, exec notifications, gateway bookkeeping) may mutate the session row but do not extend daily/idle reset freshness. Reset rollover discards queued system-event notices for the previous session before the fresh prompt is built.
- **Parent fork policy** uses Quiet Core bot's active branch when creating a thread or subagent fork. If that branch is too large, Quiet Core bot starts the child with isolated context instead of failing or inheriting unusable history. The sizing policy is automatic; legacy `session.parentForkMaxTokens` config is removed by `quiet-core-bot doctor --fix`.

Implementation detail: the decision happens in `initSessionState()` in `src/auto-reply/reply/session.ts`.

---

## Session store schema (`sessions.json`)

The store's value type is `SessionEntry` in `src/config/sessions.ts`.

Key fields (not exhaustive):

- `sessionId`: current transcript id (filename is derived from this unless `sessionFile` is set)
- `sessionStartedAt`: start timestamp for the current `sessionId`; daily reset
  freshness uses this. Legacy rows may derive it from the JSONL session header.
- `lastInteractionAt`: last real user/channel interaction timestamp; idle reset
  freshness uses this so heartbeat, cron, and exec events do not keep sessions
  alive. Legacy rows without this field fall back to the recovered session start
  time for idle freshness.
- `updatedAt`: last store-row mutation timestamp, used for listing, pruning, and
  bookkeeping. It is not the authority for daily/idle reset freshness.
- `sessionFile`: optional explicit transcript path override
- `chatType`: `direct | group | room` (helps UIs and send policy)
- `provider`, `subject`, `room`, `space`, `displayName`: metadata for group/channel labeling
- Toggles:
  - `thinkingLevel`, `verboseLevel`, `reasoningLevel`, `elevatedLevel`
  - `sendPolicy` (per-session override)
- Model selection:
  - `providerOverride`, `modelOverride`, `authProfileOverride`
- Token counters (best-effort / provider-dependent):
  - `inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`
- `compactionCount`: how often auto-compaction completed for this session key
- `memoryFlushAt`: timestamp for the last pre-compaction memory flush
- `memoryFlushCompactionCount`: compaction count when the last flush ran

The store is safe to edit, but the Gateway is the authority: it may rewrite or rehydrate entries as sessions run.

---

## Transcript structure (`*.jsonl`)

Transcripts are managed by `openclaw/plugin-sdk/agent-sessions`'s `SessionManager`.

The file is JSONL:

- First line: session header (`type: "session"`, includes `id`, `cwd`, `timestamp`, optional `parentSession`)
- Then: session entries with `id` + `parentId` (tree)

Notable entry types:

- `message`: user/assistant/toolResult messages
- `custom_message`: extension-injected messages that _do_ enter model context (can be hidden from UI)
- `custom`: extension state that does _not_ enter model context
- `compaction`: persisted compaction summary with `firstKeptEntryId`, `tokensBefore` and
  `tokensBeforeLocalEstimate`
- `branch_summary`: persisted summary when navigating a tree branch

### Compaction token dimensions (A9)

A `compaction` entry records two different token numbers on purpose — they are **different
scopes**, not two readings of the same size:

- `tokensBefore`: the local estimate the harness took with its own estimator over the transcript
  it summarised. Compare it only with `tokensAfter` of the same compaction.
- `tokensBeforeLocalEstimate`: the runner's full-prompt local estimate — the same-source baseline
  the overflow recovery criterion (`localEstimatedTokensBefore`) compares against. It is absent
  on compaction paths that never measured it (e.g. a manual compaction driven only by the
  harness).

Neither value is the provider-reported request size: the provider count is only used as the
overflow trigger and is logged as `providerRequestTokens` in the `[compaction-token-dimensions]`
line. Reading `tokensBefore` as "the pre-compaction prompt size" therefore over- or under-states
the prompt by the system prompt, tool schemas and bootstrap context, which is exactly what the
`[context-overflow-recovery] compaction-did-not-reduce` / `compaction-not-reducing` lines report
with `baselineTokensLikeForLike`.

Quiet Core bot intentionally does **not** "fix up" transcripts; the Gateway uses `SessionManager` to read/write them.

---

## Context windows vs tracked tokens

Two different concepts matter:

1. **Model context window**: hard cap per model (tokens visible to the model)
2. **Session store counters**: rolling stats written into `sessions.json` (used for /status and dashboards)

If you're tuning limits:

- The context window comes from the model catalog (and can be overridden via config).
- `contextTokens` in the store is a runtime estimate/reporting value; don't treat it as a strict guarantee.

For more, see [/token-use](/reference/token-use).

---

## Compaction: what it is

Compaction summarizes older conversation into a persisted `compaction` entry in the transcript and keeps recent messages intact.

After compaction, future turns see:

- The compaction summary
- Messages after `firstKeptEntryId`

AGENTS.md section reinjection after compaction is opt-in via
`agents.defaults.compaction.postCompactionSections`; when unset or `[]`,
Quiet Core bot does not append AGENTS.md excerpts on top of the compaction summary.

Compaction is **persistent** (unlike session pruning). See [/concepts/session-pruning](/concepts/session-pruning).

## Compaction chunk boundaries and tool pairing

When Quiet Core bot splits a long transcript into compaction chunks, it keeps
assistant tool calls paired with their matching `toolResult` entries.

- If the token-share split lands between a tool call and its result, Quiet Core bot
  shifts the boundary to the assistant tool-call message instead of separating
  the pair.
- If a trailing tool-result block would otherwise push the chunk over target,
  Quiet Core bot preserves that pending tool block and keeps the unsummarized tail
  intact.
- Aborted/error tool-call blocks do not hold a pending split open.

---

## When auto-compaction happens (Quiet Core bot runtime)

In the embedded Quiet Core bot agent, auto-compaction triggers in two cases:

1. **Overflow recovery**: the model returns a context overflow error
   (`request_too_large`, `context length exceeded`, `input exceeds the maximum
number of tokens`, `input token count exceeds the maximum number of input
tokens`, `input is too long for the model`, `ollama error: context length
exceeded`, and similar provider-shaped variants) → compact → retry.
   When the provider reports the attempted token count, Quiet Core bot forwards that
   observed count into overflow recovery compaction. If the provider confirms
   overflow but does not expose a parseable count, Quiet Core bot passes a minimally
   over-budget synthetic count to compaction engines and diagnostics.
   If overflow recovery still fails, Quiet Core bot surfaces explicit guidance to the
   user and preserves the current session mapping instead of silently rotating
   the session key to a fresh session id. The next step is operator-controlled:
   retry the message, run `/compact`, or run `/new` when a fresh session is
   preferred.
   When the overflow was raised by the **local pre-prompt estimate** (a precheck
   rather than a provider error) and compaction returns a no-op that only means
   "there is nothing to summarize" — `no_compactable_entries` (the history sits
   inside `keepRecentTokens`), `already_compacted_recently` (the last entry is
   already a compaction), or an empty transcript — Quiet Core bot does **not** treat it
   as a structural overflow. The local estimate can over-read a prompt that would
   actually fit, so Quiet Core bot resets the stale token snapshot, submits the prompt
   **best-effort once**, and lets the provider decide. This is bounded to one
   best-effort submission per run (the three no-op classes share a single budget)
   and is skipped entirely when the overflow came from a real provider error,
   which still degrades as described above. Each case emits its own line:
   `[context-overflow-precheck-noop-submit]` (no compactable region),
   `[context-overflow-precheck-already-compacted-submit]`, and
   `[context-overflow-precheck-empty-transcript-submit]`.
2. **Threshold maintenance**: after a successful turn, when:

`contextTokens > contextWindow - reserveTokens`

Where:

- `contextWindow` is the model's context window
- `reserveTokens` is headroom reserved for prompts + the next model output

These are Quiet Core bot runtime semantics.

Quiet Core bot can also trigger a preflight local compaction before opening the next
run when `agents.defaults.compaction.maxActiveTranscriptBytes` is set and the
active transcript file reaches that size. This is a file-size guard for local
reopen cost, not raw archival: Quiet Core bot still runs normal semantic compaction,
and it requires `truncateAfterCompaction` so the compacted summary can become a
new successor transcript.

For embedded Quiet Core bot runs, `agents.defaults.compaction.midTurnPrecheck.enabled: true`
adds an opt-in tool-loop guard. After a tool result is appended and before the
next model call, Quiet Core bot estimates the prompt pressure using the same preflight
budget logic used at turn start — including the provider-bound tool schemas, so a
tool result that pushes the next request over budget is detected even when the
history alone still fits. If the context no longer fits, the guard does
not compact inside Quiet Core bot runtime's `transformContext` hook. It raises a structured
mid-turn precheck signal, stops the current prompt submission, and lets the
outer run loop use the existing recovery path: truncate oversized tool results
when that is enough, or trigger the configured compaction mode and retry. The
option is disabled by default and works with both `default` and `safeguard`
compaction modes, including provider-backed safeguard compaction.
This is independent of `maxActiveTranscriptBytes`: the byte-size guard runs
before a turn opens, while mid-turn precheck runs later in the embedded Quiet Core bot tool
loop after new tool results have been appended. Enabling it also covers the
`sessions_spawn` boundary: the spawn tool result is an ordinary appended tool
result, so the parent can compact in the spawn turn instead of only at its next
turn's pre-prompt preflight.

---

## Which runtimes run the preflight memory-path compaction (`[preflight-compaction]`)

The preflight check above runs on the Quiet Core bot (embedded) runtime. Two session
classes deliberately skip it, and each skip is logged so the condition stays
observable (A19/P3-006):

| Session                                         | Behavior                                            | Log evidence                                                                  |
| ----------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Heartbeat runs                                  | skipped — a heartbeat must not compact              | `[preflight-compaction] skipped: … reason=heartbeat`                          |
| CLI-runtime sessions (for example `claude-cli`) | skipped here; the CLI runtime owns its own precheck | `[preflight-compaction] skipped: … reason=cli_runtime_uses_embedded_precheck` |
| Codex runtime sessions                          | skipped; Codex owns compaction                      | `preflightCompaction skipped: … reason=codex_native_auto_compaction`          |

The `applied` line for this path is only printed when the entry actually changed,
so an embedded session that fits its budget also prints nothing.

Verification consequence (accepted condition, not a defect): a **CLI** session can
never print `[preflight-compaction] applied`, because the CLI runtime performs its
own preflight compaction and reports it as `[context-overflow-precheck]` instead.
A19 evidence must therefore come from an embedded (gateway/agent) session, or use
the CLI's `[context-overflow-precheck]` line as the equivalent signal.

---

## Compaction settings (`reserveTokens`, `keepRecentTokens`)

Quiet Core bot runtime's compaction settings live in agent settings:

```json5
{
  compaction: {
    enabled: true,
    reserveTokens: 16384,
    keepRecentTokens: 20000,
  },
}
```

Quiet Core bot also enforces a safety floor for embedded runs:

- If `compaction.reserveTokens < reserveTokensFloor`, Quiet Core bot bumps it.
- Default floor is `20000` tokens.
- Set `agents.defaults.compaction.reserveTokensFloor: 0` to disable the floor.
- If it's already higher, Quiet Core bot leaves it alone.
- Manual `/compact` honors an explicit `agents.defaults.compaction.keepRecentTokens`
  and keeps Quiet Core bot runtime's recent-tail cut point. Without an explicit keep budget,
  manual compaction remains a hard checkpoint and rebuilt context starts from
  the new summary.
- Set `agents.defaults.compaction.midTurnPrecheck.enabled: true` to run the
  optional tool-loop precheck after new tool results and before the next model
  call. This is a trigger only; summary generation still uses the configured
  compaction path. It is independent of `maxActiveTranscriptBytes`, which is a
  turn-start active-transcript byte-size guard.
- Set `agents.defaults.compaction.maxActiveTranscriptBytes` to a byte value or
  string such as `"20mb"` to run local compaction before a turn when the active
  transcript gets large. This guard is active only when
  `truncateAfterCompaction` is also enabled. Leave it unset or set `0` to
  disable.
- When `agents.defaults.compaction.truncateAfterCompaction` is enabled,
  Quiet Core bot rotates the active transcript to a compacted successor JSONL after
  compaction. Branch/restore checkpoint actions use that compacted successor;
  legacy pre-compaction checkpoint files remain readable while referenced.

Why: leave enough headroom for multi-turn "housekeeping" (like memory writes) before compaction becomes unavoidable.

Implementation: `applyAgentCompactionSettingsFromConfig()` in `src/agents/agent-settings.ts`
(called from embedded-runner turn and compaction setup paths).

---

## Compaction timeout and model tuning (`timeoutSeconds`, `model`)

Auto-compaction summarization is an LLM call, so its cost and latency depend on
the model and provider used. Two existing keys under
`agents.defaults.compaction` tune this behavior:

- **`agents.defaults.compaction.timeoutSeconds`** (default `180`): the safety
  time budget Quiet Core bot applies to a single compact summarization call. When the
  budget is exceeded, the compaction is cancelled and surfaced as a timeout
  failure instead of hanging the run. Slow local models (for example a 12B model
  on consumer hardware) can exceed this budget while summarizing a long
  transcript, which makes compaction silently fail. If you observe compaction
  timeouts, raise this value (for example `timeoutSeconds: 600`).

- **`agents.defaults.compaction.model`** (optional): overrides which model runs
  the compaction summarization call. It accepts an exact `provider/modelId`
  string such as `"ollama/qwen3:8b"`. A heavy conversation model is overkill for
  summarization; pointing compaction at a smaller, faster model reduces both cost
  and latency. When set, compaction does **not** inherit the active session
  model fallback chain for that call, so a local-only summarization model will
  not silently fall back to a paid conversation model.

Baseline guidance for slow/limited local setups (for example a 12B local model):

- Use a dedicated small summarization model via `compaction.model` so the heavy
  conversational model stays focused on the actual turn.
- Raise `compaction.timeoutSeconds` well above the default `180` (for example to
  `600`) so summary generation has room to finish under load.
- If compaction still fails silently, check the run logs for compaction
  timeout/summary-failure diagnostics before increasing the model's own context
  budget.

These are tuning/documentation-only keys; no schema changes are required to use
them.

---

## Pluggable compaction providers

Plugins can register a compaction provider via `registerCompactionProvider()` on the plugin API. When `agents.defaults.compaction.provider` is set to a registered provider id, the safeguard extension delegates summarization to that provider instead of the built-in `summarizeInStages` pipeline.

- `provider`: id of a registered compaction provider plugin. Leave unset for default LLM summarization.
- Setting a `provider` forces `mode: "safeguard"`.
- Providers receive the same compaction instructions and identifier-preservation policy as the built-in path.
- The safeguard still preserves recent-turn and split-turn suffix context after provider output.
- Built-in safeguard summarization re-distills prior summaries with new messages
  instead of preserving the full previous summary verbatim.
- Safeguard mode enables summary quality audits by default; set
  `qualityGuard.enabled: false` to skip retry-on-malformed-output behavior.
- If the provider fails or returns an empty result, Quiet Core bot falls back to built-in LLM summarization automatically.
- Abort/timeout signals are re-thrown (not swallowed) to respect caller cancellation.

Source: `src/plugins/compaction-provider.ts`, `src/agents/agent-hooks/compaction-safeguard.ts`.

---

## User-visible surfaces

You can observe compaction and session state via:

- `/status` (in any chat session)
- `quiet-core-bot status` (CLI)
- `quiet-core-bot sessions` / `sessions --json`
- Gateway logs (`pnpm gateway:watch` or `quiet-core-bot logs --follow`): `embedded run auto-compaction start` + `complete`
- Verbose mode: `🧹 Auto-compaction complete` + compaction count

---

## Silent housekeeping (`NO_REPLY`)

Quiet Core bot supports "silent" turns for background tasks where the user should not see intermediate output.

Convention:

- The assistant starts its output with the exact silent token `NO_REPLY` /
  `no_reply` to indicate "do not deliver a reply to the user".
- Quiet Core bot strips/suppresses this in the delivery layer.
- Exact silent-token suppression is case-insensitive, so `NO_REPLY` and
  `no_reply` both count when the whole payload is just the silent token.
- This is for true background/no-delivery turns only; it is not a shortcut for
  ordinary actionable user requests.

As of `2026.1.10`, Quiet Core bot also suppresses **draft/typing streaming** when a
partial chunk begins with `NO_REPLY`, so silent operations don't leak partial
output mid-turn.

---

## Pre-compaction "memory flush" (implemented)

Goal: before auto-compaction happens, run a silent agentic turn that writes durable
state to disk (e.g. `memory/YYYY-MM-DD.md` in the agent workspace) so compaction can't
erase critical context.

Quiet Core bot uses the **pre-threshold flush** approach:

1. Monitor session context usage.
2. When it crosses a "soft threshold" (below Quiet Core bot runtime's compaction threshold), run a silent
   "write memory now" directive to the agent.
3. Use the exact silent token `NO_REPLY` / `no_reply` so the user sees
   nothing.

Config (`agents.defaults.compaction.memoryFlush`):

- `enabled` (default: `true`)
- `model` (optional exact provider/model override for the flush turn, for example `ollama/qwen3:8b`)
- `softThresholdTokens` (default: `4000`)
- `prompt` (user message for the flush turn)
- `systemPrompt` (extra system prompt appended for the flush turn)

Notes:

- The default prompt/system prompt include a `NO_REPLY` hint to suppress
  delivery.
- When `model` is set, the flush turn uses that model without inheriting the
  active session fallback chain, so local-only housekeeping does not silently
  fall back to a paid conversation model.
- The flush runs once per compaction cycle (tracked in `sessions.json`).
- The flush runs only for embedded Quiet Core bot sessions (CLI backends skip it).
- The flush is skipped when the session workspace is read-only (`workspaceAccess: "ro"` or `"none"`).
- See [Memory](/concepts/memory) for the workspace file layout and write patterns.

Quiet Core bot also exposes a `session_before_compact` hook in the extension API, but Quiet Core bot's
flush logic lives on the Gateway side today.

---

## Compaction token dimensions (`[compaction-token-dimensions]`)

Token counters on the compaction paths do **not** all share one unit. After each
overflow-recovery compaction attempt Quiet Core bot logs one line that makes the units
explicit:

```text
[compaction-token-dimensions] trigger=overflow diagId=ovf-… compacted=true \
  providerRequestTokens=277403 localEstimatedPromptTokensBefore=30441 \
  compactionEngineBeforeTokens=131073 localEstimatedTokensAfter=250 \
  dimensionBasis=provider_request_vs_local_estimate
```

| Field                              | Unit                                                    |
| ---------------------------------- | ------------------------------------------------------- |
| `providerRequestTokens`            | tokens the provider counted for the request it rejected |
| `localEstimatedPromptTokensBefore` | local prompt estimate before the compaction attempt     |
| `compactionEngineBeforeTokens`     | what the compaction engine reported as the input size   |
| `localEstimatedTokensAfter`        | local prompt estimate after the compaction              |

`dimensionBasis` names the mismatch: the attempt is being reported with a
provider-unit "before" and a local-unit "after".

This matters for reading the internal `compaction-did-not-reduce` criterion, which
compares `beforeTokens` against `tokensAfter`. When `beforeTokens` is the
provider-reported request size (1M+ on large windows) and `tokensAfter` is the local
post-compaction estimate (hundreds to tens of thousands), `before < 0.95 × after`
cannot hold, so the criterion never fires — **not** because compaction failed to
reduce anything. Treat a `compaction-did-not-reduce` miss as "the counters use
different units" (the criterion needs unit alignment) unless the same unit appears
on both sides.

For an equivalent check today, compare like with like from the same line:
`localEstimatedPromptTokensBefore` → `localEstimatedTokensAfter` for a local
reduction, or two provider reports for a provider-side reduction. The criterion
itself is unchanged (changing it is a behaviour change, tracked separately).

### Overflow diagnostic token provenance (`compactionTokensSource`)

`[context-overflow-diag]` reports the size handed to the compaction engine on the
overflow path:

```text
[context-overflow-diag] sessionKey=… provider=ollama/… source=promptError messages=12 \
  sessionFile=… diagId=ovf-… compactionAttempts=0 observedTokens=unknown \
  compactionTokens=65537 compactionTokensSource=synthetic-overbudget error=…
```

`compactionTokens` has more than one provenance and `compactionTokensSource` names
it, so the value is never read as if every line came from the provider:

| `compactionTokensSource` | Meaning                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `observed`               | `compactionTokens` is the provider-reported request size parsed out of the overflow message.                                                                                                                                   |
| `synthetic-overbudget`   | the provider message confirmed an overflow but carried no parseable token count, so `compactionTokens = window + 1` is a locally synthesized, minimally over-budget stand-in — **not** an off-by-one copied from the provider. |
| `unknown`                | neither an observed count nor a declared window was available, so no `compactionTokens` value is reported.                                                                                                                     |

The synthetic value deliberately equals the declared context window plus one so it
stays "just over budget" for engine and diagnostic consumers; a `window + 1` on a
`synthetic-overbudget` line is expected output, not drift.

---

## Degenerate compaction summaries (`[compaction-degenerate-summary]`)

A compaction can succeed **structurally** while the summary it stores carries no
context. When the summarization model never receives the conversation — the
measured case is a local model whose prompt is silently truncated to the server's
default context — it echoes the unfilled summarization template instead of
summarizing, and the transcript gains a parseable `compaction` entry whose
`summary` is a placeholder skeleton:

```text
[compaction-degenerate-summary] trigger=overflow diagId=ovf-… provider=ollama/gemma-…
  signal=meta_instruction_echo summaryChars=812: compaction succeeded but the summary is not
  usable context (the summarization model likely never received the conversation); entries
  kept only by this summary lost their context
```

The summary is **not** adopted. Before committing, Quiet Core bot rejects a degenerate
summary, logs `[compaction-degenerate-summary-rejected]` with the same `signal`
values, throws `CompactionDegenerateError`, and keeps the **original transcript**
— so a placeholder can never replace real history and no context is dropped. The
compaction is reported as failed for that attempt, which routes the caller into the
existing failure path (including preserving the pre-compaction context) instead of
silently accepting an empty summary. `signal` is one of:

| `signal`                | Meaning                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `missing_summary`       | no summary text (absent or blank)                                                    |
| `placeholder_template`  | the summary is the unfilled template, for example `[Insert primary goals here]`      |
| `meta_instruction_echo` | the model asks for the conversation or otherwise describes the summarization request |
| `summary_too_short`     | a non-blank summary below the minimum useful length                                  |

Read it together with the checkpoint: `sessions.json` →
`compactionCheckpoints[].summary` holds the text that was stored, and
`firstKeptEntryId` marks where the inline transcript resumes. Because degenerate
summaries are rejected before they are committed, a `compaction` entry that exists
is one whose summary passed the health check. Still verify the summary content
rather than the mere presence of a `compaction` entry when context fidelity
matters, and read a degenerate-summary warning plus an intact transcript as
"compaction did not happen" — not as lost context.

---

## Overflow and compaction safety signals

These lines are the runtime's safety net around compaction. Grep them when a session
looks like it lost context or stalled:

| Line                                                                                           | Meaning                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[compaction-nothing-to-compact] mode=… lastEntry=… keepRecentTokens=…`                        | The planner found no summarizable region (the history sits inside `keepRecentTokens`). No provider call is spent and no summary replaces the transcript.                                         |
| `[compaction] compaction failed (…); preserving pre-compaction context (messages=N)`           | A compaction failed or timed out. The full pre-compaction context was restored, so nothing that arrived before compaction is lost.                                                               |
| `[context-overflow-recovery] compaction-not-reducing; stopping further attempts (attempt N/3)` | A compaction did not meaningfully shrink the prompt, so Quiet Core bot stops retrying early instead of spending the remaining attempts on no progress.                                           |
| `[compaction-stalled-at-boundary] … could not compress within compactionBudgetMs=…`            | A boundary/mid-turn precheck triggered compaction but it could not finish inside the budget (timeout / summary failure / still exceeds target) — the actionable opposite of a silent truncation. |
| `[compaction-degenerate-summary-rejected] mode=… signal=… summaryChars=…`                      | A degenerate summary was produced and **refused**; the original transcript is retained (see the section above).                                                                                  |

When any of these fire, read the transcript rather than assuming the worst: the last
two mean "compaction did not do its job", and both keep the original context intact.

## Troubleshooting checklist

- Session key wrong? Start with [/concepts/session](/concepts/session) and confirm the `sessionKey` in `/status`.
- Store vs transcript mismatch? Confirm the Gateway host and the store path from `quiet-core-bot status`.
- Compaction spam? Check:
  - model context window (too small)
  - compaction settings (`reserveTokens` too high for the model window can cause earlier compaction)
  - tool-result bloat: enable/tune session pruning
- Silent turns leaking? Confirm the reply starts with `NO_REPLY` (case-insensitive exact token) and you're on a build that includes the streaming suppression fix.

## Related

- [Session management](/concepts/session)
- [Session pruning](/concepts/session-pruning)
- [Context engine](/concepts/context-engine)
