// Memory Core plugin module implements manager vector warning behavior.
export function formatMemoryVectorDegradedWriteReason(loadError?: string): string {
  return loadError
    ? `sqlite-vec unavailable: ${loadError}`
    : "semantic vector embeddings unavailable — no vector dimensions resolved";
}

/**
 * The vec0 table is created lazily once embedding dimensions are known, so a
 * database can legitimately carry a valid index without it (e.g. a database
 * published by a vector-disabled build or a partially restored state dir).
 * Vector maintenance must be skipped there instead of raising a raw
 * "no such table" error that aborts memory indexing.
 */
export function formatMemoryVectorTableMissingHint(): string {
  return (
    "memory_index_chunks_vec is missing; skipping vector row maintenance and continuing with FTS-only indexing. " +
    'Run "quiet-core-bot memory index --force" to rebuild the vector index.'
  );
}

export function logMemoryVectorDegradedWrite(params: {
  vectorEnabled: boolean;
  vectorReady: boolean;
  chunkCount: number;
  warningShown: boolean;
  loadError?: string;
  warn: (message: string) => void;
}): boolean {
  if (
    !params.vectorEnabled ||
    params.vectorReady ||
    params.chunkCount <= 0 ||
    params.warningShown
  ) {
    return params.warningShown;
  }
  params.warn(
    `memory_index_chunks_vec not updated — ${formatMemoryVectorDegradedWriteReason(params.loadError)}. Vector recall degraded. Further duplicate warnings suppressed.`,
  );
  return true;
}
