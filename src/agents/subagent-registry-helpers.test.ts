// Subagent registry helper tests cover orphan reconciliation and compact logging
// for announce delivery give-up paths.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveStorePath } from "../config/sessions.js";
import { writeSessionStoreForTest } from "../config/sessions/test-helpers.js";
import {
  resolveOwnedSessionTranscriptWriteLockRunner,
  runDetachedFromOwnedSessionTranscriptWrites,
  withOwnedSessionTranscriptWrites,
} from "../config/sessions/transcript-write-context.js";
import { defaultRuntime } from "../runtime.js";
import { readDiagnosticEvents } from "../state/diagnostic-events-store.js";
import { closeOpenClawStateDatabaseForTest } from "../state/quiet-core-bot-state-db.js";
import { withEnv, withEnvAsync } from "../test-utils/env.js";
import { removeTestTempPath } from "../test-utils/session-state-cleanup.js";
import {
  SUBAGENT_ANNOUNCE_DROP_SCOPE,
  writeAnnounceDropDiagnostic,
} from "./announce-idempotency.js";
import { normalizeAssistantReplayContent } from "./embedded-agent-runner/replay-history.js";
import {
  appendDeliveredCompletionReceipt,
  appendUndeliveredCompletionNotice,
  buildDeliveredCompletionReceiptText,
  buildUndeliveredCompletionNoticeText,
  logAnnounceGiveUp,
  reconcileOrphanedRun,
} from "./subagent-registry-helpers.js";
import type { SubagentRunRecord } from "./subagent-registry.types.js";

function createRunEntry(overrides: Partial<SubagentRunRecord> = {}): SubagentRunRecord {
  return {
    runId: "run-1",
    childSessionKey: "agent:main:subagent:child",
    requesterSessionKey: "agent:main:main",
    requesterDisplayKey: "main",
    task: "finish the task",
    cleanup: "keep",
    retainAttachmentsOnKeep: true,
    createdAt: 500,
    startedAt: 1_000,
    ...overrides,
  };
}

describe("reconcileOrphanedRun", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves timing on orphaned error outcomes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(4_000);
    const entry = createRunEntry();
    const runs = new Map([[entry.runId, entry]]);
    const resumedRuns = new Set([entry.runId]);

    expect(
      reconcileOrphanedRun({
        runId: entry.runId,
        entry,
        reason: "missing-session-id",
        source: "resume",
        runs,
        resumedRuns,
      }),
    ).toBe(true);

    expect(entry.endedAt).toBe(4_000);
    expect(entry.outcome).toEqual({
      status: "error",
      error: "orphaned subagent run (missing-session-id)",
      startedAt: 1_000,
      endedAt: 4_000,
      elapsedMs: 3_000,
    });
    expect(runs.has(entry.runId)).toBe(false);
    expect(resumedRuns.has(entry.runId)).toBe(false);
  });
});

describe("logAnnounceGiveUp", () => {
  let tempStateDir: string | null = null;

  beforeEach(async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-announce-giveup-"));
  });

  afterEach(async () => {
    vi.useRealTimers();
    closeOpenClawStateDatabaseForTest();
    if (tempStateDir) {
      await removeTestTempPath(tempStateDir);
      tempStateDir = null;
    }
  });

  // Give-up now writes a diagnostic event, so keep these cases off the real state dir.
  function withTempStateDir<T>(fn: () => T): T {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    return withEnv({ QUIET_CORE_STATE_DIR: tempStateDir }, fn);
  }

  it("includes the last delivery error in retry-limit warnings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(9_000);
    const logSpy = vi.spyOn(defaultRuntime, "log").mockImplementation(() => {});
    const entry = createRunEntry({
      endedAt: 4_000,
      delivery: {
        status: "failed",
        attemptCount: 3,
        lastError: "direct-primary: routed-dispatch-did-not-queue-final",
      },
    });

    withTempStateDir(() => {
      logAnnounceGiveUp(entry, "retry-limit");
    });

    expect(logSpy).toHaveBeenCalledWith(
      '[warn] Subagent announce give up (retry-limit) run=run-1 child=agent:main:subagent:child requester=agent:main:main retries=3 endedAgo=5s deliveryError="direct-primary: routed-dispatch-did-not-queue-final"',
    );
    logSpy.mockRestore();
  });

  it("normalizes multiline delivery errors onto one gateway log line", () => {
    // Gateway logs are line-oriented; multiline provider errors must be
    // collapsed before they enter warning text.
    const logSpy = vi.spyOn(defaultRuntime, "log").mockImplementation(() => {});
    const entry = createRunEntry({
      delivery: {
        status: "failed",
        lastError: "gateway timeout\nphase: routed dispatch failed",
      },
    });

    withTempStateDir(() => {
      logAnnounceGiveUp(entry, "expiry");
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('deliveryError="gateway timeout phase: routed dispatch failed"'),
    );
    logSpy.mockRestore();
  });

  it("records a diagnostic event so a give-up is no longer silent", () => {
    // A25: the retry-limit give-up used to leave only a log line behind.
    const logSpy = vi.spyOn(defaultRuntime, "log").mockImplementation(() => {});
    const entry = createRunEntry({
      endedAt: 4_000,
      outcome: { status: "timeout" },
      delivery: {
        status: "failed",
        attemptCount: 3,
        lastError: "requester session abandoned after timeout",
      },
    });

    withTempStateDir(() => {
      vi.useFakeTimers();
      vi.setSystemTime(9_000);
      logAnnounceGiveUp(entry, "retry-limit");
      vi.useRealTimers();

      const events = readDiagnosticEvents({ scope: SUBAGENT_ANNOUNCE_DROP_SCOPE });
      expect(events).toHaveLength(1);
      expect(events[0]?.eventKey).toBe("run-1");
      expect(events[0]?.createdAt).toBe(9_000);
      expect(events[0]?.payload).toMatchObject({
        runId: "run-1",
        reason: "retry-limit",
        reasons: ["retry-limit"],
        dropCount: 1,
        childSessionKey: "agent:main:subagent:child",
        requesterSessionKey: "agent:main:main",
        retryCount: 3,
        endedAgoMs: 5_000,
        deliveryError: "requester session abandoned after timeout",
      });
    });

    logSpy.mockRestore();
  });

  it("C5: merges a requester-abandoned drop with a later retry-limit give-up into one row", () => {
    // C5 (I14): the two real writers of subagent_announce_drop are the announce
    // path (requester_abandoned, via writeAnnounceDropDiagnostic in
    // subagent-announce.ts) and the give-up path (retry-limit, via
    // logAnnounceGiveUp). Both must refresh the SAME run-scoped row.
    const logSpy = vi.spyOn(defaultRuntime, "log").mockImplementation(() => {});
    withTempStateDir(() => {
      expect(
        writeAnnounceDropDiagnostic({
          runId: "run-dual",
          reason: "requester_abandoned",
          childSessionKey: "agent:main:subagent:child",
          requesterSessionKey: "agent:main:main",
          payload: { announceId: "v1:dual", deliveryPath: "none" },
        }),
      ).toBe(true);

      logAnnounceGiveUp(
        createRunEntry({
          runId: "run-dual",
          endedAt: 4_000,
          outcome: { status: "timeout" },
          delivery: {
            status: "failed",
            attemptCount: 3,
            lastError: "requester session abandoned after timeout",
          },
        }),
        "retry-limit",
      );

      const events = readDiagnosticEvents({ scope: SUBAGENT_ANNOUNCE_DROP_SCOPE });
      expect(events).toHaveLength(1);
      expect(events[0]?.eventKey).toBe("run-dual");
      expect(events[0]?.payload).toMatchObject({
        runId: "run-dual",
        reason: "requester_abandoned",
        reasons: ["requester_abandoned", "retry-limit"],
        latestReason: "retry-limit",
        dropCount: 2,
        childSessionKey: "agent:main:subagent:child",
        requesterSessionKey: "agent:main:main",
        announceId: "v1:dual",
        retryCount: 3,
      });
    });
    logSpy.mockRestore();
  });
});

describe("undelivered completion fallback notice", () => {
  let tempStateDir: string | null = null;

  beforeEach(async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-undelivered-notice-"));
  });

  afterEach(async () => {
    closeOpenClawStateDatabaseForTest();
    if (tempStateDir) {
      await removeTestTempPath(tempStateDir);
      tempStateDir = null;
    }
  });

  function createUndeliveredEntry(overrides: Partial<SubagentRunRecord> = {}): SubagentRunRecord {
    return createRunEntry({
      endedAt: 4_000,
      outcome: { status: "timeout" },
      delivery: {
        status: "failed",
        attemptCount: 3,
        lastError: "completion agent did not produce a visible reply",
      },
      ...overrides,
    });
  }

  async function readRequesterTranscript(storePath: string): Promise<string> {
    const sessionsDir = path.dirname(storePath);
    const files = await fs.readdir(sessionsDir);
    const transcripts = files.filter((name) => name.endsWith(".jsonl"));
    const chunks = await Promise.all(
      transcripts.map((name) => fs.readFile(path.join(sessionsDir, name), "utf8")),
    );
    return chunks.join("\n");
  }

  it("builds a notice carrying the child terminal status and drop reason", () => {
    const text = buildUndeliveredCompletionNoticeText({
      entry: createUndeliveredEntry(),
      reason: "retry-limit",
    });

    expect(text).toContain("[subagent completion not delivered]");
    expect(text).toContain("run: run-1");
    expect(text).toContain("child_session: agent:main:subagent:child");
    expect(text).toContain("status: timeout");
    expect(text).toContain("delivery: failed (retry-limit)");
    expect(text).toContain("completion agent did not produce a visible reply");
  });

  it("appends a readable notice to the requester transcript and dedupes repeats", async () => {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    await withEnvAsync({ QUIET_CORE_STATE_DIR: tempStateDir }, async () => {
      const storePath = resolveStorePath(undefined, { agentId: "main" });
      writeSessionStoreForTest(storePath, {
        "agent:main:parent": { sessionId: "parent-session", chatType: "direct" },
      });
      const entry = createUndeliveredEntry({ requesterSessionKey: "agent:main:parent" });

      expect(await appendUndeliveredCompletionNotice({ entry, reason: "retry-limit" })).toBe(true);
      // A second give-up for the same run must not duplicate the transcript row.
      await appendUndeliveredCompletionNotice({ entry, reason: "retry-limit" });

      const transcript = await readRequesterTranscript(storePath);
      const markerCount = transcript.split("[subagent completion not delivered]").length - 1;
      expect(markerCount).toBe(1);
      expect(transcript).toContain("status: timeout");
      expect(transcript).toContain(
        "delivery_error: completion agent did not produce a visible reply",
      );
    });
  });

  it("C9: writes the notice as a replay-visible delivery mirror the parent model can read", async () => {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    await withEnvAsync({ QUIET_CORE_STATE_DIR: tempStateDir }, async () => {
      const storePath = resolveStorePath(undefined, { agentId: "main" });
      writeSessionStoreForTest(storePath, {
        "agent:main:parent": { sessionId: "parent-session", chatType: "direct" },
      });
      const entry = createUndeliveredEntry({ requesterSessionKey: "agent:main:parent" });

      expect(await appendUndeliveredCompletionNotice({ entry, reason: "retry-limit" })).toBe(true);

      const transcript = await readRequesterTranscript(storePath);
      const row = transcript
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { message?: Record<string, unknown> })
        .find((parsed) =>
          JSON.stringify(parsed.message ?? {}).includes("[subagent completion not delivered]"),
        );
      expect(row?.message?.provider).toBe("quiet-core-bot");
      expect(row?.message?.model).toBe("delivery-mirror");
      expect((row?.message?.openclawDeliveryMirror as { kind?: string } | undefined)?.kind).toBe(
        "subagent-completion-undelivered",
      );

      // The same projection that drops plain delivery mirrors must keep it.
      const replay = normalizeAssistantReplayContent([
        { role: "user", content: "hello", timestamp: 0 } as never,
        row?.message as never,
      ]);
      expect(JSON.stringify(replay)).toContain("[subagent completion not delivered]");
    });
  });

  it("C6: renders an unknown terminal status when the outcome is missing", () => {
    const text = buildUndeliveredCompletionNoticeText({
      entry: createRunEntry({ requesterSessionKey: "agent:main:main" }),
      reason: "expiry",
    });
    expect(text).toContain("status: unknown");
  });

  it("returns false when the requester session is unknown", async () => {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    await withEnvAsync({ QUIET_CORE_STATE_DIR: tempStateDir }, async () => {
      const entry = createUndeliveredEntry({ requesterSessionKey: "agent:main:missing" });
      expect(await appendUndeliveredCompletionNotice({ entry, reason: "expiry" })).toBe(false);
    });
  });
});

describe("delivered completion receipt (F2/C-K2-3)", () => {
  let tempStateDir: string | null = null;

  beforeEach(async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-delivered-receipt-"));
  });

  afterEach(async () => {
    closeOpenClawStateDatabaseForTest();
    if (tempStateDir) {
      await removeTestTempPath(tempStateDir);
      tempStateDir = null;
    }
  });

  async function readRequesterTranscript(storePath: string): Promise<string> {
    const sessionsDir = path.dirname(storePath);
    const files = await fs.readdir(sessionsDir);
    const transcripts = files.filter((name) => name.endsWith(".jsonl"));
    const chunks = await Promise.all(
      transcripts.map((name) => fs.readFile(path.join(sessionsDir, name), "utf8")),
    );
    return chunks.join("\n");
  }

  function receiptParams(
    overrides: Partial<Parameters<typeof appendDeliveredCompletionReceipt>[0]>,
  ) {
    return {
      runId: "run-1",
      childSessionKey: "agent:main:subagent:child-1",
      requesterSessionKey: "agent:main:parent",
      status: "ok",
      deliveryPath: "direct",
      result: "SUB-1",
      ...overrides,
    };
  }

  it("names the child run and the delivery path in the receipt text", () => {
    const text = buildDeliveredCompletionReceiptText({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:child-1",
      status: "error",
      deliveryPath: "direct",
      result: "failed fast",
    });

    expect(text).toContain("[subagent completion delivered]");
    expect(text).toContain("run: run-1");
    expect(text).toContain("child_session: agent:main:subagent:child-1");
    expect(text).toContain("status: error");
    expect(text).toContain("delivery: delivered (direct)");
    expect(text).toContain("result: failed fast");
  });

  it("gives every concurrent child run one row and dedupes repeated deliveries", async () => {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    await withEnvAsync({ QUIET_CORE_STATE_DIR: tempStateDir }, async () => {
      const storePath = resolveStorePath(undefined, { agentId: "main" });
      writeSessionStoreForTest(storePath, {
        "agent:main:parent": { sessionId: "parent-session", chatType: "direct" },
      });

      expect(await appendDeliveredCompletionReceipt(receiptParams({}))).toBe(true);
      // A repeated delivery of the same child run must not duplicate the row.
      await appendDeliveredCompletionReceipt(receiptParams({}));
      // A second concurrent child gets its own row.
      expect(
        await appendDeliveredCompletionReceipt(
          receiptParams({
            runId: "run-2",
            childSessionKey: "agent:main:subagent:child-2",
            result: "SUB-2",
          }),
        ),
      ).toBe(true);

      const transcript = await readRequesterTranscript(storePath);
      expect(transcript.split("[subagent completion delivered]").length - 1).toBe(2);
      expect(transcript).toContain("run: run-1");
      expect(transcript).toContain("run: run-2");
      expect(transcript).toContain("child_session: agent:main:subagent:child-2");
    });
  });

  it("writes the receipt as a replay-visible delivery mirror the parent model can read", async () => {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    await withEnvAsync({ QUIET_CORE_STATE_DIR: tempStateDir }, async () => {
      const storePath = resolveStorePath(undefined, { agentId: "main" });
      writeSessionStoreForTest(storePath, {
        "agent:main:parent": { sessionId: "parent-session", chatType: "direct" },
      });

      expect(await appendDeliveredCompletionReceipt(receiptParams({}))).toBe(true);

      const transcript = await readRequesterTranscript(storePath);
      const row = transcript
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { message?: Record<string, unknown> })
        .find((parsed) =>
          JSON.stringify(parsed.message ?? {}).includes("[subagent completion delivered]"),
        );
      expect(row?.message?.provider).toBe("quiet-core-bot");
      expect(row?.message?.model).toBe("delivery-mirror");
      expect((row?.message?.openclawDeliveryMirror as { kind?: string } | undefined)?.kind).toBe(
        "subagent-completion-delivered",
      );

      // Contrast: the same projection drops a plain delivery mirror but keeps
      // the receipt (F2/C-K2-3).
      const replay = normalizeAssistantReplayContent([
        { role: "user", content: "hello", timestamp: 0 } as never,
        row?.message as never,
      ]);
      expect(JSON.stringify(replay)).toContain("[subagent completion delivered]");
    });
  });

  it("records the concrete reason when the receipt write is rejected", async () => {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    await withEnvAsync({ QUIET_CORE_STATE_DIR: tempStateDir }, async () => {
      const storePath = resolveStorePath(undefined, { agentId: "main" });
      writeSessionStoreForTest(storePath, {});
      const logSpy = vi.spyOn(defaultRuntime, "log").mockImplementation(() => {});
      let failure: string | undefined;
      try {
        expect(
          await appendDeliveredCompletionReceipt(
            receiptParams({ requesterSessionKey: "agent:main:absent" }),
          ),
        ).toBe(false);
        // mockRestore clears recorded calls, so read them while the spy is live.
        failure = logSpy.mock.calls
          .map(([message]) => String(message))
          .find((message) => message.includes("Subagent completion receipt write failed"));
      } finally {
        logSpy.mockRestore();
      }

      expect(failure).toBeDefined();
      expect(failure).toContain("run=run-1");
      expect(failure).toContain("requester=agent:main:absent");
      expect(failure).toContain("path=direct");
      expect(failure).toContain("unknown sessionKey");
    });
  });

  it("writes the receipt detached from an inherited owned prompt-write context", async () => {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    await withEnvAsync({ QUIET_CORE_STATE_DIR: tempStateDir }, async () => {
      const storePath = resolveStorePath(undefined, { agentId: "main" });
      writeSessionStoreForTest(storePath, {
        "agent:main:parent": { sessionId: "parent-session", chatType: "direct" },
      });
      // The announce task can inherit the requester run's owned prompt-write
      // context. Reusing it would fail the append (session takeover), so the
      // receipt write must detach and acquire the lock normally.
      const sessionFile = path.join(path.dirname(storePath), "parent-session.jsonl");
      let ownedRunnerUsed = false;
      let recorded: boolean | undefined;

      await withOwnedSessionTranscriptWrites(
        {
          sessionFile,
          withSessionWriteLock: async (run) => {
            ownedRunnerUsed = true;
            return await run();
          },
        },
        async () => {
          recorded = await appendDeliveredCompletionReceipt(receiptParams({}));
        },
      );

      expect(recorded).toBe(true);
      expect(ownedRunnerUsed).toBe(false);
    });
  });

  it("detaches transcript writes from an inherited owned write context", async () => {
    const sessionFile = path.join(os.tmpdir(), "quiet-core-bot-detach-probe.jsonl");
    const observed: boolean[] = [];

    await withOwnedSessionTranscriptWrites(
      { sessionFile, withSessionWriteLock: async (run) => await run() },
      async () => {
        observed.push(Boolean(resolveOwnedSessionTranscriptWriteLockRunner({ sessionFile })));
        await runDetachedFromOwnedSessionTranscriptWrites(async () => {
          observed.push(Boolean(resolveOwnedSessionTranscriptWriteLockRunner({ sessionFile })));
        });
        observed.push(Boolean(resolveOwnedSessionTranscriptWriteLockRunner({ sessionFile })));
      },
    );

    expect(observed).toEqual([true, false, true]);
  });

  it("returns false without a requester session key", async () => {
    expect(
      await appendDeliveredCompletionReceipt(receiptParams({ requesterSessionKey: "  " })),
    ).toBe(false);
  });
});
