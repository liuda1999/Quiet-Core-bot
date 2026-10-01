/** Mutates and persists isolated cron session state around one run. */
import fs from "node:fs";
import type { LiveSessionModelSelection } from "../../agents/live-model-switch.js";
import type { SessionEntry } from "../../config/sessions.js";
import { isCronSessionKey } from "../../sessions/session-key-utils.js";
import type { SkillSnapshot } from "../../skills/types.js";
import type { resolveCronSession } from "./session.js";

type MutableSessionStore = Record<string, SessionEntry>;

/** Mutable cron session entry updated by an isolated run before persistence. */
export type MutableCronSessionEntry = SessionEntry;
/** Resolved cron session plus its mutable backing store and active entry. */
export type MutableCronSession = ReturnType<typeof resolveCronSession> & {
  store: MutableSessionStore;
  sessionEntry: MutableCronSessionEntry;
};
/** Live provider/model/auth-profile selection reported by the running session. */
export type CronLiveSelection = LiveSessionModelSelection;

type UpdateSessionStore = (
  storePath: string,
  update: (store: MutableSessionStore) => void,
) => Promise<void>;

/**
 * Persists the currently selected mutable cron session entry to the session store.
 *
 * `inFlight: true` marks a write made while the run is still executing, where the
 * transcript is being written or is about to be.
 */
export type PersistCronSessionEntry = (opts?: { inFlight?: boolean }) => Promise<void>;

function cronTranscriptExists(entry: SessionEntry): boolean {
  const sessionFile = entry.sessionFile?.trim();
  return Boolean(sessionFile && fs.existsSync(sessionFile));
}

function normalizeSessionField(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toNonResumableCronSessionEntry(entry: SessionEntry): SessionEntry {
  const next = { ...entry } as Partial<SessionEntry>;
  // If the transcript never materialized, do not persist stale resume handles
  // that would make the next cron run believe a resumable CLI session exists.
  delete next.sessionId;
  delete next.sessionFile;
  delete next.sessionStartedAt;
  delete next.lastInteractionAt;
  delete next.cliSessionIds;
  delete next.cliSessionBindings;
  delete next.claudeCliSessionId;
  return next as SessionEntry;
}

/** Creates the persistence callback that stores cron session metadata after a run. */
export function createPersistCronSessionEntry(params: {
  isFastTestEnv: boolean;
  cronSession: MutableCronSession;
  agentSessionKey: string;
  updateSessionStore: UpdateSessionStore;
}): PersistCronSessionEntry {
  return async (opts) => {
    if (params.isFastTestEnv) {
      return;
    }
    // Only drop resume handles once a run has *finished* without producing a
    // transcript. Applying this to in-flight writes stripped sessionId/
    // sessionFile while the transcript was still being written, so a process
    // that died mid-run left an entry with no handles pointing at the file it
    // had already written — the transcript became unreferenced.
    const persistedEntry =
      !opts?.inFlight &&
      isCronSessionKey(params.agentSessionKey) &&
      params.cronSession.sessionEntry.sessionId &&
      !cronTranscriptExists(params.cronSession.sessionEntry)
        ? toNonResumableCronSessionEntry(params.cronSession.sessionEntry)
        : params.cronSession.sessionEntry;
    // Update both the in-memory store and persisted JSON so later operations in
    // this process observe the same session entry that hit disk.
    params.cronSession.store[params.agentSessionKey] = persistedEntry;
    await params.updateSessionStore(params.cronSession.storePath, (store) => {
      store[params.agentSessionKey] = persistedEntry;
    });
  };
}

/** Adopts the session id/file produced by a run and preserves usage-family lineage. */
export function adoptCronRunSessionMetadata(params: {
  entry: MutableCronSessionEntry;
  sessionKey: string;
  runMeta?: {
    sessionId?: string;
    sessionFile?: string;
  };
}): boolean {
  const nextSessionId = normalizeSessionField(params.runMeta?.sessionId);
  const nextSessionFile = normalizeSessionField(params.runMeta?.sessionFile);
  if (!nextSessionFile) {
    return false;
  }

  let changed = false;
  const previousSessionId = params.entry.sessionId;
  if (nextSessionId && nextSessionId !== previousSessionId) {
    params.entry.sessionId = nextSessionId;
    params.entry.usageFamilyKey = params.entry.usageFamilyKey ?? params.sessionKey;
    params.entry.usageFamilySessionIds = Array.from(
      new Set([
        ...(params.entry.usageFamilySessionIds ?? []),
        ...(previousSessionId ? [previousSessionId] : []),
        nextSessionId,
      ]),
    );
    changed = true;
  }

  if (nextSessionFile !== params.entry.sessionFile) {
    params.entry.sessionFile = nextSessionFile;
    changed = true;
  }

  return changed;
}

/** Persists a changed skills snapshot onto the cron session entry outside fast tests. */
export async function persistCronSkillsSnapshotIfChanged(params: {
  isFastTestEnv: boolean;
  cronSession: MutableCronSession;
  skillsSnapshot: SkillSnapshot;
  nowMs: number;
  persistSessionEntry: PersistCronSessionEntry;
}) {
  if (
    params.isFastTestEnv ||
    params.skillsSnapshot === params.cronSession.sessionEntry.skillsSnapshot
  ) {
    return;
  }
  params.cronSession.sessionEntry = {
    ...params.cronSession.sessionEntry,
    updatedAt: params.nowMs,
    skillsSnapshot: params.skillsSnapshot,
  };
  await params.persistSessionEntry({ inFlight: true });
}

/** Records the selected provider/model before a cron run starts. */
export function markCronSessionPreRun(params: {
  entry: MutableCronSessionEntry;
  provider: string;
  model: string;
}) {
  params.entry.modelProvider = params.provider;
  params.entry.model = params.model;
  params.entry.systemSent = true;
}

/** Syncs live model/auth-profile changes from a running cron session back to storage. */
export function syncCronSessionLiveSelection(params: {
  entry: MutableCronSessionEntry;
  liveSelection: CronLiveSelection;
}) {
  params.entry.modelProvider = params.liveSelection.provider;
  params.entry.model = params.liveSelection.model;
  if (params.liveSelection.authProfileId) {
    params.entry.authProfileOverride = params.liveSelection.authProfileId;
    params.entry.authProfileOverrideSource = params.liveSelection.authProfileIdSource;
    if (params.liveSelection.authProfileIdSource === "auto") {
      // Auto-selected profiles are tied to the compaction generation that
      // resolved them; manual overrides should survive later compactions.
      params.entry.authProfileOverrideCompactionCount = params.entry.compactionCount ?? 0;
    } else {
      delete params.entry.authProfileOverrideCompactionCount;
    }
    return;
  }
  delete params.entry.authProfileOverride;
  delete params.entry.authProfileOverrideSource;
  delete params.entry.authProfileOverrideCompactionCount;
}
