// Covers cron task-ledger completion semantics for detached cron runs.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDetachedTaskLifecycleRuntime,
  resetDetachedTaskLifecycleRuntimeForTests,
  setDetachedTaskLifecycleRuntime,
} from "../../tasks/detached-task-runtime.js";
import type { CronServiceState } from "./state.js";
import { tryFinishCronTaskRun } from "./task-runs.js";

function createCronServiceState(): CronServiceState {
  return {
    deps: { log: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } },
  } as unknown as CronServiceState;
}

function installTaskLedgerRuntime() {
  const completeTaskRunByRunId = vi.fn(() => []);
  const failTaskRunByRunId = vi.fn(() => []);
  setDetachedTaskLifecycleRuntime({
    ...getDetachedTaskLifecycleRuntime(),
    completeTaskRunByRunId,
    failTaskRunByRunId,
  });
  return { completeTaskRunByRunId, failTaskRunByRunId };
}

afterEach(() => {
  resetDetachedTaskLifecycleRuntimeForTests();
});

describe("tryFinishCronTaskRun", () => {
  it("completes the task run when only delivery failed", () => {
    const { completeTaskRunByRunId, failTaskRunByRunId } = installTaskLedgerRuntime();

    tryFinishCronTaskRun(createCronServiceState(), {
      taskRunId: "cron:job-1:1000",
      status: "error",
      error: "no configured messaging channel for announce delivery",
      errorKind: "delivery-target",
      endedAt: 1100,
      summary: "done",
    });

    expect(completeTaskRunByRunId).toHaveBeenCalledTimes(1);
    expect(failTaskRunByRunId).not.toHaveBeenCalled();
  });

  it("fails the task run for a genuine execution error", () => {
    const { completeTaskRunByRunId, failTaskRunByRunId } = installTaskLedgerRuntime();

    tryFinishCronTaskRun(createCronServiceState(), {
      taskRunId: "cron:job-2:2000",
      status: "error",
      error: "boom",
      endedAt: 2100,
    });

    expect(failTaskRunByRunId).toHaveBeenCalledTimes(1);
    expect(completeTaskRunByRunId).not.toHaveBeenCalled();
  });
});
