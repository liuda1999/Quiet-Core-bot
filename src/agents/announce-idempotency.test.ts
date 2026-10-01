// Announce idempotency tests cover the drop diagnostic identity used when a
// completion announce can no longer be delivered (A25 / I14).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDiagnosticEvents } from "../state/diagnostic-events-store.js";
import { closeQuietCoreStateDatabaseForTest } from "../state/quiet-core-bot-state-db.js";
import { withEnv } from "../test-utils/env.js";
import { removeTestTempPath } from "../test-utils/session-state-cleanup.js";
import {
  buildAnnounceDropEventKey,
  mergeAnnounceDropReasons,
  SUBAGENT_ANNOUNCE_DROP_SCOPE,
  writeAnnounceDropDiagnostic,
} from "./announce-idempotency.js";

describe("mergeAnnounceDropReasons", () => {
  it("keeps the terminal cause first when a retry budget later runs out", () => {
    expect(mergeAnnounceDropReasons("requester_abandoned", "retry-limit")).toEqual([
      "requester_abandoned",
      "retry-limit",
    ]);
  });

  it("promotes a later terminal cause above an earlier budget reason", () => {
    expect(mergeAnnounceDropReasons("retry-limit", "requester_abandoned")).toEqual([
      "requester_abandoned",
      "retry-limit",
    ]);
  });

  it("accepts an existing reasons array and stays idempotent", () => {
    expect(mergeAnnounceDropReasons(["requester_abandoned", "retry-limit"], "retry-limit")).toEqual(
      ["requester_abandoned", "retry-limit"],
    );
  });

  it("keeps first-seen order for reasons outside the priority list", () => {
    expect(mergeAnnounceDropReasons(undefined, "generated_media_missing")).toEqual([
      "generated_media_missing",
    ]);
  });
});

describe("buildAnnounceDropEventKey", () => {
  it("scopes the event key to the run so one run cannot produce two rows", () => {
    expect(buildAnnounceDropEventKey({ runId: " run-1 " })).toBe("run-1");
  });
});

describe("writeAnnounceDropDiagnostic", () => {
  let tempStateDir: string | null = null;

  beforeEach(async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-announce-drop-"));
  });

  afterEach(async () => {
    closeQuietCoreStateDatabaseForTest();
    if (tempStateDir) {
      await removeTestTempPath(tempStateDir);
      tempStateDir = null;
    }
  });

  function withTempStateDir<T>(fn: () => T): T {
    if (!tempStateDir) {
      throw new Error("expected temp state dir");
    }
    return withEnv({ QUIET_CORE_STATE_DIR: tempStateDir }, fn);
  }

  it("merges a second drop of the same run into one row with both reasons", () => {
    withTempStateDir(() => {
      expect(
        writeAnnounceDropDiagnostic({
          runId: "run-dual",
          reason: "requester_abandoned",
          childSessionKey: "agent:main:subagent:dual",
          requesterSessionKey: "agent:main:main",
          payload: { announceId: "v1:dual", deliveryPath: "none" },
        }),
      ).toBe(true);
      expect(
        writeAnnounceDropDiagnostic({
          runId: "run-dual",
          reason: "retry-limit",
          payload: { retryCount: 5 },
        }),
      ).toBe(true);

      const events = readDiagnosticEvents({ scope: SUBAGENT_ANNOUNCE_DROP_SCOPE });
      expect(events).toHaveLength(1);
      expect(events[0]?.eventKey).toBe("run-dual");
      expect(events[0]?.payload).toMatchObject({
        runId: "run-dual",
        reason: "requester_abandoned",
        reasons: ["requester_abandoned", "retry-limit"],
        latestReason: "retry-limit",
        dropCount: 2,
        childSessionKey: "agent:main:subagent:dual",
        requesterSessionKey: "agent:main:main",
        announceId: "v1:dual",
        retryCount: 5,
      });
    });
  });

  it("keeps one row per run across repeated drops and ignores invalid input", () => {
    withTempStateDir(() => {
      writeAnnounceDropDiagnostic({ runId: "run-a", reason: "expiry" });
      writeAnnounceDropDiagnostic({ runId: "run-b", reason: "retry-limit" });
      expect(writeAnnounceDropDiagnostic({ runId: " ", reason: "retry-limit" })).toBe(false);
      expect(writeAnnounceDropDiagnostic({ runId: "run-c", reason: "  " })).toBe(false);

      const events = readDiagnosticEvents({ scope: SUBAGENT_ANNOUNCE_DROP_SCOPE });
      expect(events.map((event) => event.eventKey).sort()).toEqual(["run-a", "run-b"]);
      const runA = events.find((event) => event.eventKey === "run-a");
      expect(runA?.payload).toMatchObject({ reason: "expiry", reasons: ["expiry"], dropCount: 1 });
    });
  });
});
