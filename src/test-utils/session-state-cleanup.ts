// Cleans session-related shared state after tests.
import fsSync from "node:fs";
import fs from "node:fs/promises";
import { drainSessionWriteLockStateForTest } from "../agents/session-write-lock.js";
import { clearSessionStoreCaches } from "../config/sessions/store-cache.js";
import { drainSessionStoreWriterQueuesForTest } from "../config/sessions/store-writer-state.js";
import { drainFileLockStateForTest } from "../infra/file-lock.js";
import {
  closeQuietCoreStateDatabase,
  closeQuietCoreStateDatabaseUnder,
} from "../state/quiet-core-bot-state-db.js";

/** Busy-style errno codes Windows reports while a tracked file is still open. */
const TEMP_CLEANUP_BUSY_CODES = new Set(["EBUSY", "EPERM", "ENOTEMPTY", "EACCES"]);
/** Maximum bounded removal attempts before the shared helper gives up loudly. */
const TEMP_CLEANUP_MAX_ATTEMPTS = 50;

function resolveBusyErrnoCode(error: unknown): string | undefined {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}

function isBusyCleanupError(error: unknown): boolean {
  const code = resolveBusyErrnoCode(error);
  return code !== undefined && TEMP_CLEANUP_BUSY_CODES.has(code);
}

function cleanupErrorMessage(target: string): string {
  return `failed to remove test temp path ${target}`;
}

/**
 * Removes a test temp path with a bounded retry that never delegates to Node's
 * internal `fs.rm` retry loop. On Windows that internal loop can neither reject
 * nor resolve while a file stays busy (an open SQLite handle is the usual
 * cause), which used to hang whole Vitest workers until the no-output watchdog
 * killed the run. Here each busy attempt first releases the cached state
 * database handles and then retries without depending on timers.
 */
export async function removeTestTempPath(target: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < TEMP_CLEANUP_MAX_ATTEMPTS; attempt += 1) {
    try {
      // No maxRetries: the bounded loop below replaces Node's own retry path.
      await fs.rm(target, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!isBusyCleanupError(error)) {
        throw error;
      }
      closeQuietCoreStateDatabaseUnder(target);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(cleanupErrorMessage(target));
}

/** Synchronous twin of {@link removeTestTempPath} for sync temp-dir helpers. */
export function removeTestTempPathSync(target: string): void {
  let lastError: unknown;
  for (let attempt = 0; attempt < TEMP_CLEANUP_MAX_ATTEMPTS; attempt += 1) {
    try {
      fsSync.rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!isBusyCleanupError(error)) {
        throw error;
      }
      closeQuietCoreStateDatabaseUnder(target);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(cleanupErrorMessage(target));
}

let fileLockDrainerForTests: typeof drainFileLockStateForTest | null = null;
let sessionStoreWriterQueueDrainerForTests: typeof drainSessionStoreWriterQueuesForTest | null =
  null;
let sessionWriteLockDrainerForTests: typeof drainSessionWriteLockStateForTest | null = null;

/** Overrides cleanup hooks so tests can drain mocked session state modules. */
export function setSessionStateCleanupRuntimeForTests(params: {
  drainFileLockStateForTest?: typeof drainFileLockStateForTest | null;
  drainSessionStoreWriterQueuesForTest?: typeof drainSessionStoreWriterQueuesForTest | null;
  drainSessionWriteLockStateForTest?: typeof drainSessionWriteLockStateForTest | null;
}): void {
  if ("drainFileLockStateForTest" in params) {
    fileLockDrainerForTests = params.drainFileLockStateForTest ?? null;
  }
  if ("drainSessionStoreWriterQueuesForTest" in params) {
    sessionStoreWriterQueueDrainerForTests = params.drainSessionStoreWriterQueuesForTest ?? null;
  }
  if ("drainSessionWriteLockStateForTest" in params) {
    sessionWriteLockDrainerForTests = params.drainSessionWriteLockStateForTest ?? null;
  }
}

export function resetSessionStateCleanupRuntimeForTests(): void {
  fileLockDrainerForTests = null;
  sessionStoreWriterQueueDrainerForTests = null;
  sessionWriteLockDrainerForTests = null;
}

export async function cleanupSessionStateForTest(): Promise<void> {
  await (sessionStoreWriterQueueDrainerForTests ?? drainSessionStoreWriterQueuesForTest)();
  clearSessionStoreCaches();
  await (fileLockDrainerForTests ?? drainFileLockStateForTest)();
  await (sessionWriteLockDrainerForTests ?? drainSessionWriteLockStateForTest)();
  // Release cached state database handles before callers delete temp homes: an
  // open SQLite handle keeps the .sqlite/-wal/-shm files locked, which makes the
  // Windows temp-home fs.rm retry indefinitely instead of settling.
  closeQuietCoreStateDatabase();
}
