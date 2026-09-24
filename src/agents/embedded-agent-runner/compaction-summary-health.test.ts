import { describe, expect, it } from "vitest";
import { detectDegenerateCompactionSummary } from "./compaction-summary-health.js";

// Verbatim (truncated) from `sessions.json` compaction checkpoint for
// `agent:main:s4b3-t23c` — local Ollama at a silently-truncated 4096 context.
const MEASURED_DEGENERATE_V1 =
  "Please provide the conversation text so I can generate the summary for you! Since the conversation " +
  "content was not provided in your prompt, here is the structure based on your requirements:\n\n" +
  "## Goal\n[User's primary objectives]\n\n## Constraints & Preferences\n- [Requirement 1]\n- [Requirement 2]";

// Variant quoted in the stage-4 batch-3 report.
const MEASURED_DEGENERATE_V2 =
  "Please provide the conversation content between the user and the AI coding assistant. " +
  "Since the conversation was not included in your prompt, I cannot generate the summary.\n\n" +
  "## Goal\n[Insert primary goals here]";

describe("detectDegenerateCompactionSummary", () => {
  it("flags both measured unfilled-template summaries", () => {
    expect(detectDegenerateCompactionSummary(MEASURED_DEGENERATE_V1)).toEqual({
      degenerate: true,
      signal: "meta_instruction_echo",
      summaryChars: MEASURED_DEGENERATE_V1.length,
    });
    expect(detectDegenerateCompactionSummary(MEASURED_DEGENERATE_V2)).toEqual({
      degenerate: true,
      signal: "placeholder_template",
      summaryChars: MEASURED_DEGENERATE_V2.length,
    });
  });

  it("flags a template skeleton without an explicit insert slot", () => {
    const skeleton =
      "## Goal\n[User's primary objectives]\n## Blocked\n[Any blockers]\n## Next Steps\n[Next action]";
    expect(detectDegenerateCompactionSummary(skeleton).signal).toBe("placeholder_template");
  });

  it("flags missing and blank summaries", () => {
    expect(detectDegenerateCompactionSummary(undefined).signal).toBe("missing_summary");
    expect(detectDegenerateCompactionSummary("   \n\t ").signal).toBe("missing_summary");
  });

  it("flags an abnormally short summary", () => {
    expect(detectDegenerateCompactionSummary("Done.").signal).toBe("summary_too_short");
  });

  it("does not flag a real summary", () => {
    const real =
      "## Goal\nThe user asked to persist the scheduler state across restarts.\n\n" +
      "## Current Work\nAdded a SQLite-backed run ledger and verified restart recovery.";
    expect(detectDegenerateCompactionSummary(real)).toEqual({
      degenerate: false,
      summaryChars: real.length,
    });
  });

  it("does not flag real prose that happens to use one bracketed phrase", () => {
    const real =
      "## Goal\nThe user referenced [the upstream issue] and asked for a fix in the scheduler path, " +
      "including restart coverage and a regression test for the persistence layer.\n" +
      "## Decisions\nKeep the existing lock ordering; revisit in the next review.";
    expect(detectDegenerateCompactionSummary(real).degenerate).toBe(false);
  });
});
