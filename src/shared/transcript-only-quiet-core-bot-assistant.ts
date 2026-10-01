// Identifies Quiet Core bot-authored assistant rows that are transcript bookkeeping,
// not provider model output. Some history surfaces keep gateway-injected rows
// visible, so use the narrower delivery-mirror predicate when visibility matters.
const TRANSCRIPT_ONLY_QUIET_CORE_ASSISTANT_MODELS = new Set<string>([
  "delivery-mirror",
  "gateway-injected",
]);

export function isTranscriptOnlyQuietCoreAssistantModel(provider: unknown, model: unknown): boolean {
  return (
    provider === "quiet-core-bot" &&
    typeof model === "string" &&
    TRANSCRIPT_ONLY_QUIET_CORE_ASSISTANT_MODELS.has(model)
  );
}

export function isTranscriptOnlyQuietCoreAssistantMessage(message: unknown): boolean {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const entry = message as { role?: unknown; provider?: unknown; model?: unknown };
  return (
    entry.role === "assistant" &&
    isTranscriptOnlyQuietCoreAssistantModel(entry.provider, entry.model)
  );
}

export function isQuietCoreDeliveryMirrorAssistantMessage(message: unknown): boolean {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const entry = message as { role?: unknown; provider?: unknown; model?: unknown };
  return (
    entry.role === "assistant" && entry.provider === "quiet-core-bot" && entry.model === "delivery-mirror"
  );
}

/**
 * Delivery-mirror rows that must survive the replay projection.
 *
 * A raw delivery mirror is transcript bookkeeping and is dropped from replay,
 * but a subagent completion receipt (delivered or undelivered) is the parent
 * run's record that a specific child run finished, so dropping it makes the
 * completion invisible to the parent model. Such rows opt in through their
 * `openclawDeliveryMirror.kind` marker; every other mirror is still dropped.
 */
const REPLAY_VISIBLE_DELIVERY_MIRROR_KINDS = new Set<string>([
  "subagent-completion-undelivered",
  "subagent-completion-delivered",
]);

export function isReplayVisibleDeliveryMirrorAssistantMessage(message: unknown): boolean {
  if (!isQuietCoreDeliveryMirrorAssistantMessage(message)) {
    return false;
  }
  const marker = (message as { openclawDeliveryMirror?: { kind?: unknown } })
    .openclawDeliveryMirror;
  return typeof marker?.kind === "string" && REPLAY_VISIBLE_DELIVERY_MIRROR_KINDS.has(marker.kind);
}
