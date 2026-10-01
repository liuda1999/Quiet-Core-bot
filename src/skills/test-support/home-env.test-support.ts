// Home environment test support isolates HOME-style paths for skill tests.
import os from "node:os";
import { vi } from "vitest";
import { deleteTestEnvValue, setTestEnvValue } from "../../test-utils/env.js";

/** Process home env snapshot used by skill loader tests. */
export type SkillsHomeEnvSnapshot = {
  previousHome: string | undefined;
  previousQuietCoreHome: string | undefined;
  previousUserProfile: string | undefined;
};

export function setMockSkillsHomeEnv(fakeHome: string): SkillsHomeEnvSnapshot {
  const snapshot: SkillsHomeEnvSnapshot = {
    previousHome: process.env.HOME,
    previousQuietCoreHome: process.env.QUIET_CORE_HOME,
    previousUserProfile: process.env.USERPROFILE,
  };
  setTestEnvValue("HOME", fakeHome);
  deleteTestEnvValue("QUIET_CORE_HOME");
  deleteTestEnvValue("USERPROFILE");
  vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
  return snapshot;
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    deleteTestEnvValue(key);
  } else {
    setTestEnvValue(key, value);
  }
}

export async function restoreMockSkillsHomeEnv(
  snapshot: SkillsHomeEnvSnapshot,
  cleanup?: () => Promise<void> | void,
) {
  vi.restoreAllMocks();
  restoreEnvValue("HOME", snapshot.previousHome);
  restoreEnvValue("QUIET_CORE_HOME", snapshot.previousQuietCoreHome);
  restoreEnvValue("USERPROFILE", snapshot.previousUserProfile);
  await cleanup?.();
}
