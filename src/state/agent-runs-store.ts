// Persisted ledger of embedded agent runs so restarts leave visible traces.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { executeSqliteQuerySync, getNodeSqliteKysely } from "../infra/kysely-sync.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { DB as QuietCoreStateKyselyDatabase } from "./quiet-core-bot-state-db.generated.js";
import {
  openQuietCoreStateDatabase,
  runQuietCoreStateWriteTransaction,
} from "./quiet-core-bot-state-db.js";
import { resolveQuietCoreStateSqliteDir } from "./quiet-core-bot-state-db.paths.js";

/**
 * Durable run ledger (`agent_runs`).
 *
 * Embedded runs already exist in process memory; this module only mirrors their
 * lifecycle into the shared state database so an operator can see which runs a
 * previous gateway process left behind. Every write is best-effort: a ledger
 * failure must never break the run it describes.
 */
export type AgentRunStatus = "running" | "ok" | "timeout" | "interrupted" | "failed" | "abandoned";

export type AgentRunTerminalStatus = Exclude<AgentRunStatus, "running">;

export type AgentRunLedgerEntry = {
  runId: string;
  sessionKey: string | null;
  sessionId: string | null;
  status: AgentRunStatus;
  startedAt: number;
  endedAt: number | null;
  endedReason: string | null;
  updatedAt: number;
};

export type ListAgentRunsParams = {
  sessionKey?: string;
  status?: AgentRunStatus;
  limit?: number;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

const ledgerLog = createSubsystemLogger("state/agent-runs");
const agentRunStatuses = new Set<AgentRunStatus>([
  "running",
  "ok",
  "timeout",
  "interrupted",
  "failed",
  "abandoned",
]);

// Identifies this process instance in `agent_runs` rows so a later process can
// tell whether a still-`running` row belongs to someone else.
const processInstanceId = randomUUID();

/** Set once a process sweeps the ledger so run starts do not rescan every time. */
let sweptThisProcess = false;

type AgentRunsKyselyDatabase = Pick<QuietCoreStateKyselyDatabase, "agent_runs">;

function toNullableText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function warnLedgerFailure(operation: string, err: unknown): void {
  ledgerLog.warn(`agent run ledger ${operation} failed: ${String(err)}`);
}

function parseAgentRunStatus(value: string): AgentRunStatus {
  return agentRunStatuses.has(value as AgentRunStatus) ? (value as AgentRunStatus) : "failed";
}

/** Best-effort liveness check used to avoid clobbering another process's runs. */
function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // Only ESRCH proves the process is gone; EPERM means it exists under
    // another user and must be treated as alive.
    return (err as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_LIST_LIMIT);
}

/** Record a run that just started (or re-registered) as `running`. */
export function recordAgentRunStarted(params: {
  runId: string;
  sessionId?: string;
  sessionKey?: string;
  startedAt?: number;
}): void {
  const runId = params.runId.trim();
  if (!runId) {
    return;
  }
  try {
    maybeSweepStaleAgentRuns();
    const now = Date.now();
    const startedAt = params.startedAt ?? now;
    runQuietCoreStateWriteTransaction(({ db }) => {
      const kysely = getNodeSqliteKysely<AgentRunsKyselyDatabase>(db);
      executeSqliteQuerySync(
        db,
        kysely
          .insertInto("agent_runs")
          .values({
            run_id: runId,
            session_key: toNullableText(params.sessionKey),
            session_id: toNullableText(params.sessionId),
            status: "running",
            started_at: startedAt,
            ended_at: null,
            ended_reason: null,
            owner_pid: process.pid,
            owner_instance_id: processInstanceId,
            updated_at: now,
          })
          .onConflict((conflict) =>
            conflict.column("run_id").doUpdateSet({
              session_key: toNullableText(params.sessionKey),
              session_id: toNullableText(params.sessionId),
              status: "running",
              started_at: startedAt,
              ended_at: null,
              ended_reason: null,
              owner_pid: process.pid,
              owner_instance_id: processInstanceId,
              updated_at: now,
            }),
          ),
      );
    });
  } catch (err) {
    warnLedgerFailure("start write", err);
  }
}

/**
 * Mark a run terminal.
 *
 * The `status = 'running'` guard keeps the first terminal decision: a sweeper
 * that already marked a run `interrupted` is not overwritten by a late
 * completion for the same run id.
 *
 * A failure here (a held SQLite lock is the usual cause) would otherwise leave
 * the row `running` forever, so the outcome is queued and replayed until the
 * write lands. The queue is in process memory on purpose: if the owner dies
 * first, the next process's startup sweep closes the row as `interrupted`.
 */
export function recordAgentRunEnded(params: {
  runId: string;
  status: AgentRunTerminalStatus;
  endedReason?: string;
  endedAt?: number;
}): void {
  const runId = params.runId.trim();
  if (!runId) {
    return;
  }
  flushPendingTerminalWrites();
  try {
    writeAgentRunEndedRow({
      runId,
      status: params.status,
      endedReason: params.endedReason,
      endedAt: params.endedAt,
    });
  } catch (err) {
    warnLedgerFailure("end write", err);
    enqueuePendingTerminalWrite({
      runId,
      status: params.status,
      endedReason: params.endedReason,
      endedAt: params.endedAt,
    });
  }
}

/** One `agent_runs` terminal write, throwing when the write itself fails. */
function writeAgentRunEndedRow(params: {
  runId: string;
  status: AgentRunTerminalStatus;
  endedReason?: string;
  endedAt?: number;
}): void {
  if (forcedTerminalWriteFailures > 0) {
    forcedTerminalWriteFailures -= 1;
    throw new Error("database is locked");
  }
  const now = Date.now();
  runQuietCoreStateWriteTransaction(({ db }) => {
    const kysely = getNodeSqliteKysely<AgentRunsKyselyDatabase>(db);
    executeSqliteQuerySync(
      db,
      kysely
        .updateTable("agent_runs")
        .set({
          status: params.status,
          ended_at: params.endedAt ?? now,
          ended_reason: toNullableText(params.endedReason),
          updated_at: now,
        })
        .where("run_id", "=", params.runId)
        .where("status", "=", "running"),
    );
  });
}

type PendingTerminalWrite = {
  runId: string;
  status: AgentRunTerminalStatus;
  endedReason?: string;
  endedAt?: number;
  attempts: number;
  nextAttemptAtMs: number;
};

const PENDING_TERMINAL_WRITE_BASE_RETRY_MS = 1_000;
const PENDING_TERMINAL_WRITE_MAX_RETRY_MS = 30_000;

const pendingTerminalWrites = new Map<string, PendingTerminalWrite>();
let pendingTerminalWriteTimer: ReturnType<typeof setTimeout> | null = null;
let forcedTerminalWriteFailures = 0;

// A12: the compensation queue used to be process memory only, so a crash inside the window between
// "end write failed" and "retry landed" lost the terminal decision entirely and the next process's
// sweep relabelled the run `interrupted`. The queue is mirrored to a small JSON file next to the
// state database; the `status = 'running'` guard still decides which write wins.
const PENDING_TERMINAL_WRITE_FILE = "agent-runs-pending-terminal-writes.json";

function resolvePendingTerminalWriteFile(): string {
  return path.join(resolveQuietCoreStateSqliteDir(process.env), PENDING_TERMINAL_WRITE_FILE);
}

function isTerminalRunStatus(value: unknown): value is AgentRunTerminalStatus {
  return (
    typeof value === "string" &&
    value !== "running" &&
    agentRunStatuses.has(value as AgentRunStatus)
  );
}

/** Best-effort read of terminal decisions a previous process could not land. */
function readPersistedPendingTerminalWrites(): Array<{
  runId: string;
  status: AgentRunTerminalStatus;
  endedReason?: string;
  endedAt?: number;
}> {
  const file = resolvePendingTerminalWriteFile();
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    // No file is the normal case: every compensation write is replayed or nothing failed.
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const record = entry as Record<string, unknown>;
      const runId = typeof record["runId"] === "string" ? record["runId"].trim() : "";
      if (!runId || !isTerminalRunStatus(record["status"])) {
        return [];
      }
      const endedReason = record["endedReason"];
      const endedAt = record["endedAt"];
      return [
        {
          runId,
          status: record["status"],
          ...(typeof endedReason === "string" ? { endedReason } : {}),
          ...(typeof endedAt === "number" && Number.isFinite(endedAt) ? { endedAt } : {}),
        },
      ];
    });
  } catch (err) {
    warnLedgerFailure("pending terminal write read", err);
    return [];
  }
}

/** Mirror the in-memory compensation queue to disk so a crash cannot drop a terminal decision. */
function writePersistedPendingTerminalWrites(): void {
  const file = resolvePendingTerminalWriteFile();
  const entries = [...pendingTerminalWrites.values()].map((entry) => ({
    runId: entry.runId,
    status: entry.status,
    ...(entry.endedReason !== undefined ? { endedReason: entry.endedReason } : {}),
    ...(entry.endedAt !== undefined ? { endedAt: entry.endedAt } : {}),
  }));
  try {
    if (entries.length === 0) {
      fs.rmSync(file, { force: true });
      return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tempFile = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(entries, null, 2), "utf8");
    fs.renameSync(tempFile, file);
  } catch (err) {
    // The ledger is best-effort: a persistence failure must not fail the run it describes, but it
    // must be visible — otherwise the compensation window silently becomes memory-only again.
    warnLedgerFailure("pending terminal write persist", err);
  }
}

function pendingTerminalWriteBackoffMs(attempts: number): number {
  return Math.min(
    PENDING_TERMINAL_WRITE_MAX_RETRY_MS,
    PENDING_TERMINAL_WRITE_BASE_RETRY_MS * 2 ** Math.min(attempts, 5),
  );
}

function enqueuePendingTerminalWrite(params: {
  runId: string;
  status: AgentRunTerminalStatus;
  endedReason?: string;
  endedAt?: number;
}): void {
  const attempts = pendingTerminalWrites.get(params.runId)?.attempts ?? 0;
  pendingTerminalWrites.set(params.runId, {
    ...params,
    attempts,
    nextAttemptAtMs: Date.now() + pendingTerminalWriteBackoffMs(attempts),
  });
  // A12: persist before scheduling the retry, so the decision survives a crash in the window.
  writePersistedPendingTerminalWrites();
  ledgerLog.warn(
    `agent run ledger end write queued for compensation: runId=${params.runId} status=${params.status}`,
  );
  schedulePendingTerminalWriteFlush();
}

function schedulePendingTerminalWriteFlush(): void {
  if (pendingTerminalWriteTimer !== null || pendingTerminalWrites.size === 0) {
    return;
  }
  const now = Date.now();
  let delayMs = Number.POSITIVE_INFINITY;
  for (const entry of pendingTerminalWrites.values()) {
    delayMs = Math.min(delayMs, Math.max(0, entry.nextAttemptAtMs - now));
  }
  pendingTerminalWriteTimer = setTimeout(() => {
    pendingTerminalWriteTimer = null;
    flushPendingTerminalWrites();
  }, delayMs);
  pendingTerminalWriteTimer.unref?.();
}

/**
 * Replay queued terminal writes whose backoff has elapsed. Returns the number of
 * rows closed by this pass; entries that fail again stay queued with a longer
 * backoff until the state database accepts them.
 */
export function flushPendingTerminalWrites(): number {
  if (pendingTerminalWriteTimer !== null) {
    clearTimeout(pendingTerminalWriteTimer);
    pendingTerminalWriteTimer = null;
  }
  if (pendingTerminalWrites.size === 0) {
    return 0;
  }
  const now = Date.now();
  let closed = 0;
  for (const [runId, entry] of [...pendingTerminalWrites]) {
    if (entry.nextAttemptAtMs > now) {
      continue;
    }
    entry.attempts += 1;
    try {
      writeAgentRunEndedRow({
        runId,
        status: entry.status,
        endedReason: entry.endedReason,
        endedAt: entry.endedAt,
      });
      pendingTerminalWrites.delete(runId);
      closed += 1;
      ledgerLog.warn(
        `agent run ledger end write compensated after ${entry.attempts} attempt(s): runId=${runId} status=${entry.status}`,
      );
    } catch {
      entry.nextAttemptAtMs = Date.now() + pendingTerminalWriteBackoffMs(entry.attempts);
    }
  }
  if (closed > 0) {
    // A12: drop the landed decisions from the on-disk mirror as well.
    writePersistedPendingTerminalWrites();
  }
  schedulePendingTerminalWriteFlush();
  return closed;
}

/**
 * A12: replay terminal decisions a previous process persisted but could not land.
 *
 * Runs before the stale sweep so a run that really finished keeps its recorded outcome instead of
 * being relabelled `interrupted`; the `status = 'running'` guard in the write still decides.
 */
function recoverPersistedPendingTerminalWrites(): number {
  const persisted = readPersistedPendingTerminalWrites();
  if (persisted.length === 0) {
    return 0;
  }
  for (const entry of persisted) {
    if (!pendingTerminalWrites.has(entry.runId)) {
      pendingTerminalWrites.set(entry.runId, { ...entry, attempts: 0, nextAttemptAtMs: 0 });
    }
  }
  const closed = flushPendingTerminalWrites();
  ledgerLog.warn(
    `agent run ledger recovered ${persisted.length} persisted terminal write(s) from a previous process; closed=${closed}`,
  );
  return closed;
}

/**
 * Mark leftover `running` rows from dead processes as `interrupted`.
 *
 * Safety: only rows whose owning pid is missing or provably gone are touched, so
 * a process that merely opens the shared database (CLI query, doctor) can never
 * mark a live gateway's in-flight runs. Returns the number of rows marked.
 */
export function sweepStaleAgentRuns(params?: {
  reason?: string;
  isOwnerAlive?: (pid: number) => boolean;
}): number {
  const reason = params?.reason ?? "gateway restart";
  const ownerAlive = params?.isOwnerAlive ?? isProcessAlive;
  try {
    return runQuietCoreStateWriteTransaction(({ db }) => {
      const kysely = getNodeSqliteKysely<AgentRunsKyselyDatabase>(db);
      const runningRows = executeSqliteQuerySync(
        db,
        kysely
          .selectFrom("agent_runs")
          .select(["run_id", "owner_pid"])
          .where("status", "=", "running"),
      ).rows;
      const staleRunIds = runningRows
        .filter((row) => row.owner_pid === null || !ownerAlive(Number(row.owner_pid)))
        .map((row) => row.run_id);
      if (staleRunIds.length === 0) {
        return 0;
      }
      const now = Date.now();
      const result = executeSqliteQuerySync(
        db,
        kysely
          .updateTable("agent_runs")
          .set({ status: "interrupted", ended_at: now, ended_reason: reason, updated_at: now })
          .where("run_id", "in", staleRunIds)
          .where("status", "=", "running"),
      );
      return Number(result.numAffectedRows ?? 0);
    });
  } catch (err) {
    warnLedgerFailure("stale sweep", err);
    return 0;
  }
}

/**
 * Sweep once per process, at the first run registration or ledger query.
 *
 * That first touch happens before this process owns any run, so the sweep can
 * only ever mark runs from an earlier process.
 */
export function maybeSweepStaleAgentRuns(reason?: string): number {
  if (sweptThisProcess) {
    return 0;
  }
  sweptThisProcess = true;
  // A12: land any terminal decision a previous process persisted before the sweep runs, so a
  // completed run is not relabelled `interrupted` and the decision is not lost with the process.
  recoverPersistedPendingTerminalWrites();
  return sweepStaleAgentRuns(reason === undefined ? undefined : { reason });
}

/** List ledger rows newest first, optionally filtered by session key and status. */
export function listAgentRuns(params?: ListAgentRunsParams): AgentRunLedgerEntry[] {
  try {
    maybeSweepStaleAgentRuns();
    const sessionKey = params?.sessionKey?.trim();
    const limit = clampLimit(params?.limit);
    const db = openQuietCoreStateDatabase().db;
    const kysely = getNodeSqliteKysely<AgentRunsKyselyDatabase>(db);
    let query = kysely
      .selectFrom("agent_runs")
      .select([
        "run_id",
        "session_key",
        "session_id",
        "status",
        "started_at",
        "ended_at",
        "ended_reason",
        "updated_at",
      ])
      .orderBy("started_at", "desc")
      .orderBy("run_id", "asc")
      .limit(limit);
    if (sessionKey) {
      query = query.where("session_key", "=", sessionKey);
    }
    if (params?.status) {
      query = query.where("status", "=", params.status);
    }
    return executeSqliteQuerySync(db, query).rows.map((row) => ({
      runId: row.run_id,
      sessionKey: row.session_key,
      sessionId: row.session_id,
      status: parseAgentRunStatus(row.status),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      endedReason: row.ended_reason,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    warnLedgerFailure("query", err);
    return [];
  }
}

export const testing = {
  resetSweepStateForTest() {
    sweptThisProcess = false;
  },
  processInstanceId,
  isProcessAlive,
  /** Make the next N terminal writes fail as if the state database were locked. */
  failNextTerminalWrites(count: number) {
    forcedTerminalWriteFailures = Math.max(0, Math.floor(count));
  },
  resetPendingTerminalWritesForTest() {
    if (pendingTerminalWriteTimer !== null) {
      clearTimeout(pendingTerminalWriteTimer);
      pendingTerminalWriteTimer = null;
    }
    pendingTerminalWrites.clear();
    forcedTerminalWriteFailures = 0;
    fs.rmSync(resolvePendingTerminalWriteFile(), { force: true });
  },
  /**
   * A12: drop in-memory compensation state the way a process death would, while leaving the
   * on-disk mirror intact — the crash window the persistence is meant to survive.
   */
  simulateProcessCrashForTest() {
    if (pendingTerminalWriteTimer !== null) {
      clearTimeout(pendingTerminalWriteTimer);
      pendingTerminalWriteTimer = null;
    }
    pendingTerminalWrites.clear();
    forcedTerminalWriteFailures = 0;
  },
  persistedPendingTerminalWriteRunIdsForTest(): string[] {
    return readPersistedPendingTerminalWrites().map((entry) => entry.runId);
  },
  pendingTerminalWriteRunIdsForTest(): string[] {
    return [...pendingTerminalWrites.keys()];
  },
  /** Drive the compensation queue directly, ignoring the retry backoff. */
  flushPendingTerminalWritesForTest(): number {
    for (const entry of pendingTerminalWrites.values()) {
      entry.nextAttemptAtMs = 0;
    }
    return flushPendingTerminalWrites();
  },
};
