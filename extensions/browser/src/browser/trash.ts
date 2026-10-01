/**
 * Trash helpers for Browser-owned files constrained to user and QuietCore temp
 * roots.
 */
import os from "node:os";
import { movePathToTrash as movePathToTrashWithAllowedRoots } from "quiet-core-bot/plugin-sdk/browser-config";
import { resolvePreferredQuietCoreTmpDir } from "quiet-core-bot/plugin-sdk/temp-path";

/** Moves a path to trash only when it lives under allowed Browser roots. */
export async function movePathToTrash(targetPath: string): Promise<string> {
  return await movePathToTrashWithAllowedRoots(targetPath, {
    allowedRoots: [os.homedir(), resolvePreferredQuietCoreTmpDir()],
  });
}
