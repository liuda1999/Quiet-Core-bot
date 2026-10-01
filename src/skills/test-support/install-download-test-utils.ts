// Install download test utilities provide isolated state and workspace paths.
import {
  createQuietCoreTestState,
  type QuietCoreTestState,
} from "../../test-utils/quiet-core-bot-test-state.js";

/** Creates isolated Quiet Core bot state for install download tests. */
export async function createInstallDownloadTestState(): Promise<QuietCoreTestState> {
  return await createQuietCoreTestState({
    layout: "state-only",
    prefix: "quiet-core-bot-skills-install-",
  });
}
