/** Detects whether a daemon was launched by Quiet Core bot's container-aware service wrapper. */
import { normalizeOptionalString } from "@quiet-core/normalization-core/string-coerce";

/** Resolves the daemon container hint exposed by managed service environments. */
export function resolveDaemonContainerContext(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return (
    normalizeOptionalString(env.QUIET_CORE_CONTAINER_HINT) ||
    normalizeOptionalString(env.QUIET_CORE_CONTAINER) ||
    null
  );
}
