/**
 * Diagnostic event records in the shared sqlite state database.
 *
 * Diagnostic events are keyed by (scope, event_key), so a repeated condition
 * refreshes one row instead of growing the table. Writes are best-effort:
 * diagnostics must never break the caller.
 */
import { executeSqliteQuerySync, getNodeSqliteKysely } from "../infra/kysely-sync.js";
import type { DB as OpenClawStateKyselyDatabase } from "./quiet-core-bot-state-db.generated.js";
import {
  openOpenClawStateDatabase,
  runOpenClawStateWriteTransaction,
} from "./quiet-core-bot-state-db.js";

type DiagnosticEventsDatabase = Pick<OpenClawStateKyselyDatabase, "diagnostic_events">;

/** One persisted diagnostic event row. */
export type DiagnosticEventRecord = {
  scope: string;
  eventKey: string;
  payload: unknown;
  createdAt: number;
};

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Writes (or refreshes) one diagnostic event row. Returns whether the write landed. */
export function writeDiagnosticEvent(params: {
  scope: string;
  eventKey: string;
  payload?: unknown;
  createdAt?: number;
}): boolean {
  const scope = params.scope.trim();
  const eventKey = params.eventKey.trim();
  if (!scope || !eventKey) {
    return false;
  }
  try {
    const createdAt = params.createdAt ?? Date.now();
    const payloadJson = JSON.stringify(params.payload ?? {});
    runOpenClawStateWriteTransaction(({ db }) => {
      const stateDb = getNodeSqliteKysely<DiagnosticEventsDatabase>(db);
      executeSqliteQuerySync(
        db,
        stateDb
          .insertInto("diagnostic_events")
          .values({
            scope,
            event_key: eventKey,
            payload_json: payloadJson,
            created_at: createdAt,
          })
          .onConflict((conflict) =>
            conflict.columns(["scope", "event_key"]).doUpdateSet({
              payload_json: payloadJson,
              created_at: createdAt,
            }),
          ),
      );
    });
    return true;
  } catch {
    return false;
  }
}

/** Reads diagnostic events for one scope, newest first. */
export function readDiagnosticEvents(params: {
  scope: string;
  limit?: number;
}): DiagnosticEventRecord[] {
  const scope = params.scope.trim();
  if (!scope) {
    return [];
  }
  const limit = Math.max(1, Math.floor(params.limit ?? 50));
  const { db } = openOpenClawStateDatabase();
  const stateDb = getNodeSqliteKysely<DiagnosticEventsDatabase>(db);
  const rows = executeSqliteQuerySync(
    db,
    stateDb
      .selectFrom("diagnostic_events")
      .selectAll()
      .where("scope", "=", scope)
      .orderBy("created_at", "desc")
      .orderBy("event_key", "asc")
      .limit(limit),
  ).rows;
  return rows.map((row) => ({
    scope: row.scope,
    eventKey: row.event_key,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  }));
}

/** Reads one diagnostic event row by key, or undefined when it has not been written. */
export function readDiagnosticEvent(params: {
  scope: string;
  eventKey: string;
}): DiagnosticEventRecord | undefined {
  const scope = params.scope.trim();
  const eventKey = params.eventKey.trim();
  if (!scope || !eventKey) {
    return undefined;
  }
  const { db } = openOpenClawStateDatabase();
  const stateDb = getNodeSqliteKysely<DiagnosticEventsDatabase>(db);
  const row = executeSqliteQuerySync(
    db,
    stateDb
      .selectFrom("diagnostic_events")
      .selectAll()
      .where("scope", "=", scope)
      .where("event_key", "=", eventKey)
      .limit(1),
  ).rows[0];
  if (!row) {
    return undefined;
  }
  return {
    scope: row.scope,
    eventKey: row.event_key,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  };
}
