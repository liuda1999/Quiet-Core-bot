// Batch K1 · Task 3 — parent session × multiple subagent sessions:
// context isolation and task handoff audit.
//
// Covers, deterministically:
//   · isolation  — an `isolated` (default) child never inherits parent history,
//                  and the parent transcript never holds child-internal turns;
//   · fork       — a `context="fork"` child gets a *snapshot* of the parent
//                  transcript that then diverges from the parent;
//   · handoff    — the announce text is the child's last visible assistant text,
//                  capped at FROZEN_RESULT_TEXT_MAX_BYTES (100KB);
//   · ledger     — `subagent_runs.completion_announced_at` is set and
//                  `pending_final_delivery` returns to 0 after delivery;
//   · concurrency — ≥3 children stay independently isolated and independently
//                  announced; the parent only aggregates announce rows;
//   · compaction — compacting the parent does not touch a child transcript and
//                  vice versa;
//   · C9         — an undelivered completion notice stays visible in the parent
//                  replay projection.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildSessionContext,
  InMemorySessionStorage,
  prepareCompaction,
  Session,
} from "quiet-core-bot/plugin-sdk/agent-core";
import type { AgentMessage, SessionTreeEntry } from "quiet-core-bot/plugin-sdk/agent-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forkSessionFromParent } from "../auto-reply/reply/session-fork.js";
import { CURRENT_SESSION_VERSION } from "../config/sessions/version.js";
import { executeSqliteQuerySync, getNodeSqliteKysely } from "../infra/kysely-sync.js";
import type { DB as OpenClawStateDatabase } from "../state/quiet-core-bot-state-db.generated.js";
import {
  closeOpenClawStateDatabaseForTest,
  openOpenClawStateDatabase,
} from "../state/quiet-core-bot-state-db.js";
import { withEnvAsync } from "../test-utils/env.js";
import {
  buildAnnounceDropEventKey,
  buildAnnounceIdempotencyKey,
  buildAnnounceIdFromChildRun,
} from "./announce-idempotency.js";
import { normalizeAssistantReplayContent } from "./embedded-agent-runner/replay-history.js";
import {
  buildChildCompletionFindings,
  dedupeLatestChildCompletionRows,
  readSubagentOutput,
  testing as subagentAnnounceOutputTesting,
} from "./subagent-announce-output.js";
import { normalizeSubagentRunState } from "./subagent-delivery-state.js";
import { buildSubagentInitialUserMessage } from "./subagent-initial-user-message.js";
import {
  buildUndeliveredCompletionNoticeText,
  capFrozenResultText,
} from "./subagent-registry-helpers.js";
import {
  readSubagentRunRecordFromSqlite,
  saveSubagentRegistryToSqlite,
} from "./subagent-registry.store.sqlite.js";
import type { SubagentRunRecord } from "./subagent-registry.types.js";

const FROZEN_RESULT_TEXT_MAX_BYTES = 100 * 1024;

function usage() {
  return {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function userMessage(text: string): AgentMessage {
  return { role: "user", content: text, timestamp: 0 } as unknown as AgentMessage;
}

function assistantText(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "responses",
    provider: "audit-provider",
    model: "audit-model",
    usage: usage(),
    stopReason: "stop",
    timestamp: 0,
  } as unknown as AgentMessage;
}

// ---------------------------------------------------------------------------
// Isolation + fork (real filesystem, real fork runtime)
// ---------------------------------------------------------------------------

async function writeParentTranscript(sessionsDir: string, sessionId: string) {
  const sessionFile = path.join(sessionsDir, `${sessionId}.jsonl`);
  const header = {
    type: "session",
    version: CURRENT_SESSION_VERSION,
    id: sessionId,
    timestamp: new Date().toISOString(),
    cwd: sessionsDir,
  };
  const entries = [
    {
      type: "message",
      id: "p0",
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: "user", content: "PARENT-HISTORY-ONLY", timestamp: 0 },
    },
    {
      type: "message",
      id: "p1",
      parentId: "p0",
      timestamp: new Date().toISOString(),
      message: {
        role: "assistant",
        content: [{ type: "text", text: "PARENT-REPLY" }],
        api: "responses",
        provider: "audit-provider",
        model: "audit-model",
        usage: usage(),
        stopReason: "stop",
        timestamp: 0,
      },
    },
  ];
  await fs.writeFile(
    sessionFile,
    `${[header, ...entries].map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    "utf-8",
  );
  return { sessionFile, entries };
}

async function readTranscriptMessages(sessionFile: string): Promise<string> {
  return await fs.readFile(sessionFile, "utf-8");
}

describe("Task 3 · subagent context isolation and handoff", () => {
  let tempDir: string;
  let sessionsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-k1-isolation-"));
    sessionsDir = path.join(tempDir, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
  });

  afterEach(async () => {
    subagentAnnounceOutputTesting.setDepsForTest(undefined);
    // Release the sqlite handle before removing the temp state dir (Windows keeps
    // an open database file locked, which would hang the recursive removal).
    closeOpenClawStateDatabaseForTest();
    await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it("keeps an isolated child free of parent history (task envelope only)", () => {
    // The default spawn context is "isolated": no fork is performed, so the
    // child transcript is bootstrapped solely from the delegated task envelope.
    const envelope = buildSubagentInitialUserMessage({
      childDepth: 1,
      maxSpawnDepth: 3,
      persistentSession: false,
      task: "SUM-CHILD-TASK: summarise the changelog",
    });

    expect(envelope).toContain("[Subagent Task]");
    expect(envelope).toContain("SUM-CHILD-TASK: summarise the changelog");
    // Nothing from the parent conversation leaks into the isolated bootstrap.
    expect(envelope).not.toContain("PARENT-HISTORY-ONLY");
    expect(envelope).not.toContain("PARENT-REPLY");
  });

  it("forks a parent snapshot that then diverges from the live parent", async () => {
    const { sessionFile } = await writeParentTranscript(sessionsDir, "parent-session");

    const fork = await forkSessionFromParent({
      parentEntry: { sessionId: "parent-session", sessionFile, updatedAt: 1 },
      agentId: "main",
      sessionsDir,
    });
    expect(fork).not.toBeNull();
    if (!fork) {
      throw new Error("expected a forked session");
    }

    const childText = await readTranscriptMessages(fork.sessionFile);
    // Fork = snapshot: the child carries the parent branch as of fork time.
    expect(childText).toContain("PARENT-HISTORY-ONLY");
    expect(childText).toContain("PARENT-REPLY");
    // Provenance: the child header points back at the parent transcript.
    const childHeader = JSON.parse(childText.split("\n")[0]) as { parentSession?: string };
    expect(childHeader.parentSession).toBe(sessionFile);

    // Now the parent moves on. The child must NOT observe the new turn.
    await fs.appendFile(
      sessionFile,
      `${JSON.stringify({
        type: "message",
        id: "p2",
        parentId: "p1",
        timestamp: new Date().toISOString(),
        message: { role: "user", content: "PARENT-NEW-TURN", timestamp: 0 },
      })}\n`,
      "utf-8",
    );

    const parentText = await fs.readFile(sessionFile, "utf-8");
    const childTextAfter = await readTranscriptMessages(fork.sessionFile);
    expect(parentText).toContain("PARENT-NEW-TURN");
    expect(childTextAfter).not.toContain("PARENT-NEW-TURN");
    expect(childTextAfter).toBe(childText);
  });

  it("hands off the child's last visible assistant text and caps it at 100KB", async () => {
    const messages = [
      { role: "user", content: "do the work", timestamp: 1 },
      {
        role: "assistant",
        content: [{ type: "text", text: "working on it" }],
        timestamp: 2,
      },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "t1", name: "exec", arguments: {} }],
        timestamp: 3,
      },
      {
        role: "toolResult",
        toolCallId: "t1",
        toolName: "exec",
        content: [{ type: "text", text: "tool output that must not be announced" }],
        isError: false,
        timestamp: 4,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "CHILD-FINAL-VISIBLE-ANSWER" }],
        timestamp: 5,
      },
    ];
    const readSessionMessagesAsync = vi.fn(async () => messages);
    subagentAnnounceOutputTesting.setDepsForTest({ readSessionMessagesAsync });

    const handoff = await readSubagentOutput("agent:main:subagent:child", undefined, {
      sessionFile: path.join(tempDir, "child.jsonl"),
    });

    // Handoff = the child's LAST visible assistant text, not the tool output.
    expect(handoff).toBe("CHILD-FINAL-VISIBLE-ANSWER");
    expect(handoff).not.toContain("tool output that must not be announced");
    expect(readSessionMessagesAsync).toHaveBeenCalledOnce();

    // ≤100KB cap boundary.
    const oversized = `START-${"x".repeat(FROZEN_RESULT_TEXT_MAX_BYTES)}-END`;
    const capped = capFrozenResultText(oversized);
    expect(Buffer.byteLength(capped, "utf8")).toBeLessThanOrEqual(FROZEN_RESULT_TEXT_MAX_BYTES);
    expect(capped).toContain("[truncated: frozen completion output exceeded 100KB");
    expect(capped.startsWith("START-")).toBe(true);
    // A payload exactly at the cap is preserved verbatim.
    const atCap = "y".repeat(FROZEN_RESULT_TEXT_MAX_BYTES);
    expect(capFrozenResultText(atCap)).toBe(atCap);
  });

  it("records completion_announced_at and clears pending_final_delivery", async () => {
    const stateDir = path.join(tempDir, "state-dir");
    await fs.mkdir(stateDir, { recursive: true });

    await withEnvAsync({ QUIET_CORE_STATE_DIR: stateDir }, async () => {
      const delivered: SubagentRunRecord = normalizeSubagentRunState({
        runId: "run-delivered",
        childSessionKey: "agent:main:subagent:delivered",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "deliver",
        cleanup: "keep",
        createdAt: 100,
        startedAt: 110,
        endedAt: 200,
        outcome: { status: "ok" },
        expectsCompletionMessage: true,
        delivery: {
          status: "delivered",
          createdAt: 210,
          announcedAt: 220,
          deliveredAt: 220,
          attemptCount: 1,
        },
      });
      const pending: SubagentRunRecord = normalizeSubagentRunState({
        runId: "run-pending",
        childSessionKey: "agent:main:subagent:pending",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "still pending",
        cleanup: "keep",
        createdAt: 100,
        startedAt: 110,
        expectsCompletionMessage: true,
        delivery: { status: "pending", createdAt: 210, attemptCount: 0 },
      });

      saveSubagentRegistryToSqlite(
        new Map([
          [delivered.runId, delivered],
          [pending.runId, pending],
        ]),
      );

      const { db } = openOpenClawStateDatabase();
      const stateDb = getNodeSqliteKysely<Pick<OpenClawStateDatabase, "subagent_runs">>(db);
      const rows = executeSqliteQuerySync(
        db,
        stateDb
          .selectFrom("subagent_runs")
          .select(["run_id", "completion_announced_at", "pending_final_delivery"])
          .orderBy("run_id", "asc"),
      ).rows;
      const byId = new Map(rows.map((row) => [row.run_id, row]));

      // Delivered completion: announced timestamp set, pending flag cleared to 0.
      expect(byId.get("run-delivered")?.completion_announced_at).toBeGreaterThan(0);
      expect(byId.get("run-delivered")?.pending_final_delivery).toBe(0);
      // Undelivered completion: no announced timestamp, pending flag set to 1.
      expect(byId.get("run-pending")?.completion_announced_at).toBeNull();
      expect(byId.get("run-pending")?.pending_final_delivery).toBe(1);

      // The typed read path agrees with the raw columns.
      const restored = readSubagentRunRecordFromSqlite({ runId: "run-delivered" });
      expect(restored?.delivery?.status).toBe("delivered");
      expect(restored?.delivery?.announcedAt).toBe(220);
    });
  });

  it("keeps ≥3 concurrent children independently isolated and announced", async () => {
    const children = [1, 2, 3].map((n) => ({
      runId: `run-${n}`,
      childSessionKey: `agent:main:subagent:child-${n}`,
      requesterSessionKey: "agent:main:main",
      task: `task-${n}`,
      label: `child-${n}`,
      createdAt: n,
      endedAt: 100 + n,
      completion: { resultText: `RESULT-${n}` },
      outcome: { status: "ok" as const },
    }));

    // Each child announces its own result — the parent aggregates, never merges.
    const findings = buildChildCompletionFindings(children);
    expect(findings).toBeDefined();
    for (const child of children) {
      expect(findings).toContain(`RESULT-${children.indexOf(child) + 1}`);
    }
    expect(findings?.match(/status: ok/g)).toHaveLength(3);

    // Duplicate rows for one child collapse to the newest, others stay separate.
    const deduped = dedupeLatestChildCompletionRows([
      ...children,
      { ...children[0], createdAt: 0, completion: { resultText: "STALE-RESULT-1" } },
    ]);
    expect(deduped).toHaveLength(3);
    const childOneRow = deduped.find((row) => row.childSessionKey === children[0].childSessionKey);
    expect(childOneRow?.completion?.resultText).toBe("RESULT-1");

    // Announce identity is per child run: no cross-talk between siblings.
    const keys = children.map((child) =>
      buildAnnounceIdempotencyKey(
        buildAnnounceIdFromChildRun({
          childSessionKey: child.childSessionKey,
          childRunId: child.runId,
        }),
      ),
    );
    expect(new Set(keys).size).toBe(3);
    const dropKeys = children.map((child) => buildAnnounceDropEventKey({ runId: child.runId }));
    expect(new Set(dropKeys).size).toBe(3);

    // The parent transcript only ever receives the announce rows, not child internals.
    const parentSession = new Session(new InMemorySessionStorage());
    await parentSession.appendMessage(userMessage("spawn three workers"));
    for (const child of children) {
      await parentSession.appendMessage(assistantText(`child ${child.childSessionKey} done`));
    }
    const parentContext = await parentSession.buildContext();
    expect(parentContext.messages).toHaveLength(4);
    expect(parentContext.messages.slice(1).every((m) => m.role === "assistant")).toBe(true);
    // No child-internal turn leaked into the parent.
    expect(JSON.stringify(parentContext.messages)).not.toContain("RESULT-");
  });
});

// ---------------------------------------------------------------------------
// Compaction independence (parent vs child)
// ---------------------------------------------------------------------------

function messageEntry(
  id: string,
  parentId: string | null,
  message: AgentMessage,
): SessionTreeEntry {
  return { type: "message", id, parentId, timestamp: new Date().toISOString(), message };
}

function longHistory(prefix: string, turns: number): SessionTreeEntry[] {
  const entries: SessionTreeEntry[] = [];
  let parentId: string | null = null;
  for (let i = 0; i < turns; i += 1) {
    const uid = `${prefix}-u${i}`;
    entries.push(
      messageEntry(uid, parentId, userMessage(`${prefix} user turn ${i} ${"z".repeat(300)}`)),
    );
    parentId = uid;
    const aid = `${prefix}-a${i}`;
    entries.push(messageEntry(aid, parentId, assistantText(`${prefix} assistant turn ${i}`)));
    parentId = aid;
  }
  return entries;
}

describe("Task 3 · parent/child compaction independence", () => {
  it("compacting the parent leaves the child transcript untouched", async () => {
    const parentEntries = longHistory("parent", 4);
    const childEntries = longHistory("child", 4);

    const parentSession = new Session(new InMemorySessionStorage({ entries: parentEntries }));
    const childSession = new Session(new InMemorySessionStorage({ entries: childEntries }));
    const childBefore = await childSession.getEntries();

    // Parent compacts independently.
    const preparation = prepareCompaction(parentEntries, {
      enabled: true,
      reserveTokens: 1000,
      keepRecentTokens: 50,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok || !preparation.value) {
      throw new Error("expected a summarizable parent region");
    }
    await parentSession.appendCompaction("PARENT-SUMMARY", preparation.value.firstKeptEntryId, 500);

    const parentAfter = await parentSession.getEntries();
    expect(parentAfter.some((entry) => entry.type === "compaction")).toBe(true);

    // Child is completely untouched by the parent's compaction.
    expect(await childSession.getEntries()).toEqual(childBefore);
    expect(parentAfter).not.toEqual(childBefore);
    const childContext = await childSession.buildContext();
    expect(buildSessionContext(childEntries).messages).toEqual(childContext.messages);
    expect(childContext.messages.some((m) => m.role === "compactionSummary")).toBe(false);
  });

  it("lets the child compact independently of the parent", async () => {
    const parentEntries = longHistory("parent", 4);
    const childEntries = longHistory("child", 4);
    const parentSession = new Session(new InMemorySessionStorage({ entries: parentEntries }));
    const childSession = new Session(new InMemorySessionStorage({ entries: childEntries }));

    const childPreparation = prepareCompaction(childEntries, {
      enabled: true,
      reserveTokens: 1000,
      keepRecentTokens: 50,
    });
    expect(childPreparation.ok).toBe(true);
    if (!childPreparation.ok || !childPreparation.value) {
      throw new Error("expected a summarizable child region");
    }
    await childSession.appendCompaction(
      "CHILD-SUMMARY",
      childPreparation.value.firstKeptEntryId,
      400,
    );

    const childContext = await childSession.buildContext();
    expect((childContext.messages[0] as { summary?: string }).summary).toBe("CHILD-SUMMARY");
    // The parent still has no compaction row of its own.
    expect((await parentSession.getEntries()).some((entry) => entry.type === "compaction")).toBe(
      false,
    );
    expect((await parentSession.buildContext()).messages).toEqual(
      buildSessionContext(parentEntries).messages,
    );
  });
});

// ---------------------------------------------------------------------------
// C9 — undelivered completion notice visibility
// ---------------------------------------------------------------------------

describe("Task 3 · C9 fallback visibility", () => {
  it("surfaces [subagent completion not delivered] in the parent replay projection", () => {
    const entry = normalizeSubagentRunState({
      runId: "run-dropped",
      childSessionKey: "agent:main:subagent:dropped",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "deliver but dropped",
      cleanup: "keep",
      createdAt: 1,
      endedAt: 2,
      outcome: { status: "ok" },
      expectsCompletionMessage: true,
    });

    const noticeText = buildUndeliveredCompletionNoticeText({ entry, reason: "retry-limit" });
    expect(noticeText).toContain("[subagent completion not delivered]");
    expect(noticeText).toContain("delivery: failed (retry-limit)");

    // The parent replay projection drops a bare delivery mirror but keeps the
    // marked undelivered-completion notice (C9).
    const mirror = (kind: string, text: string) =>
      ({
        role: "assistant",
        content: [{ type: "text", text }],
        api: "responses",
        provider: "quiet-core-bot",
        model: "delivery-mirror",
        openclawDeliveryMirror: { kind },
        usage: usage(),
        stopReason: "stop",
        timestamp: 0,
      }) as unknown as AgentMessage;

    const replayed = normalizeAssistantReplayContent([
      userMessage("hello"),
      mirror("subagent-completion-undelivered", noticeText),
      mirror("some-other-kind", "plain mirror"),
    ]);

    expect(JSON.stringify(replayed)).toContain("[subagent completion not delivered]");
    expect(JSON.stringify(replayed)).not.toContain("plain mirror");
  });
});
