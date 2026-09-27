// Verifies lightweight command summaries stay independent from tree-sitter and
// the rich command explainer dependency graph.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// This shard runs with `isolate: false`, so a hoisted `vi.mock` factory here also
// fires for sibling files that import the explainer for real, aborting their
// collection. Guard the lazy boundary per test instead (mirroring the other
// lazy-runtime tests) and reset modules so the guard cannot pass against a
// cached explainer module.
describe("command-analysis lazy command explainer", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../command-explainer/extract.js");
    vi.resetModules();
  });

  it("does not load tree-sitter parser dependencies for node argv summaries", async () => {
    const loadExplainer = vi.fn();
    vi.doMock("../command-explainer/extract.js", () => {
      loadExplainer();
      throw new Error("command explainer should not load for lightweight summaries");
    });

    const { resolveCommandAnalysisSummaryForDisplay } = await import("./explain.js");

    const summary = await resolveCommandAnalysisSummaryForDisplay({
      host: "node",
      commandText: "python3 script.py",
      commandArgv: ["python3", "-c", "print(1)"],
    });

    expect(loadExplainer).not.toHaveBeenCalled();
    if (!summary) {
      throw new Error("expected command analysis summary");
    }
    expect(summary.commandCount).toBe(1);
    expect(summary.riskKinds).toEqual(["inline-eval"]);
    expect(summary.warningLines).toEqual(["Contains inline-eval: python3 -c"]);
  });
});
