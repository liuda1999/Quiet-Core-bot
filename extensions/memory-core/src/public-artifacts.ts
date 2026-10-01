// Memory Core plugin module implements public artifacts behavior.
import {
  listMemoryHostPublicArtifacts,
  type MemoryPluginPublicArtifact,
} from "quiet-core-bot/plugin-sdk/memory-host-core";
import type { QuietCoreConfig } from "../api.js";

export async function listMemoryCorePublicArtifacts(params: {
  cfg: QuietCoreConfig;
}): Promise<MemoryPluginPublicArtifact[]> {
  return await listMemoryHostPublicArtifacts(params);
}
