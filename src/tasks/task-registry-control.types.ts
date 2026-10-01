// Defines task control runtime contracts exposed to command surfaces.
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";

/** Admin cancellation hook for ACP sessions owned by task records. */
export type CancelAcpSessionAdmin = (params: {
  cfg: QuietCoreConfig;
  sessionKey: string;
  reason: string;
}) => Promise<void>;

export type KillSubagentRunAdminResult = {
  found: boolean;
  killed: boolean;
  runId?: string;
  sessionKey?: string;
  cascadeKilled?: number;
  cascadeLabels?: string[];
};

export type KillSubagentRunAdmin = (params: {
  cfg: QuietCoreConfig;
  sessionKey: string;
}) => Promise<KillSubagentRunAdminResult>;

export type TaskRegistryControlRuntime = {
  getAcpSessionManager: () => {
    cancelSession: CancelAcpSessionAdmin;
  };
  killSubagentRunAdmin: KillSubagentRunAdmin;
};
