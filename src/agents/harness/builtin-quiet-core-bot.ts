/**
 * Built-in Quiet Core bot harness registration.
 *
 * Harness selection uses this factory to expose the embedded Quiet Core bot runtime
 * through the same AgentHarness contract as external harness plugins.
 */
import { QUIET_CORE_EMBEDDED_CONTEXT_ENGINE_HOST } from "../../context-engine/host-compat.js";
import { runEmbeddedAttempt } from "../embedded-agent-runner/run/attempt.js";
import type { AgentHarness } from "./types.js";

/** Creates the built-in harness backed by the embedded Quiet Core bot agent runner. */
export function createOpenClawAgentHarness(): AgentHarness {
  return {
    id: "quiet-core-bot",
    label: "Quiet Core bot embedded agent",
    contextEngineHostCapabilities: QUIET_CORE_EMBEDDED_CONTEXT_ENGINE_HOST.capabilities,
    supports: () => ({ supported: true, priority: 0 }),
    runAttempt: runEmbeddedAttempt,
  };
}
