// Prompt budget advice tests cover doctor guidance for compaction budgets.
import { describe, expect, it } from "vitest";
import { buildPromptBudgetDoctorAdvice } from "./doctor-prompt-budget-advice.js";

describe("buildPromptBudgetDoctorAdvice", () => {
  it("stays quiet when keepRecentTokens is unset and doctor is not deep", () => {
    expect(
      buildPromptBudgetDoctorAdvice({
        contextWindowTokens: 200_000,
        modelKey: "openai/gpt-5.5",
        reserveTokens: 20_000,
      }),
    ).toEqual([]);
  });

  it("shows the budget arithmetic in deep doctor output", () => {
    expect(
      buildPromptBudgetDoctorAdvice({
        contextWindowTokens: 200_000,
        modelKey: "openai/gpt-5.5",
        reserveTokens: 20_000,
        configuredKeepRecentTokens: 12_000,
        fixedOverheadTokens: 9_000,
        deep: true,
      }),
    ).toEqual([
      '- primary model "openai/gpt-5.5" context window 200,000 tokens; reserve 20,000; prompt budget 180,000; fixed prompt overhead ~9,000 tokens (workspace context + skills; system prompt and tool schemas excluded); keepRecentTokens 12,000',
    ]);
  });

  it("warns when keepRecentTokens can never leave a compactable region", () => {
    expect(
      buildPromptBudgetDoctorAdvice({
        contextWindowTokens: 16_384,
        modelKey: "local/qwen3",
        reserveTokens: 8_384,
        configuredKeepRecentTokens: 20_000,
      }),
    ).toEqual([
      '- compaction.keepRecentTokens is 20,000 tokens but the reserve-adjusted prompt budget for "local/qwen3" is 8,000. No transcript can ever exceed the prompt budget, so every overflow compaction reports no_compactable_entries and is skipped. Lower agents.defaults.compaction.keepRecentTokens to below 8,000, or raise the model contextWindow.',
    ]);
  });

  it("warns when fixed prompt overhead already fills the prompt budget", () => {
    expect(
      buildPromptBudgetDoctorAdvice({
        contextWindowTokens: 16_384,
        modelKey: "local/qwen3",
        reserveTokens: 8_384,
        fixedOverheadTokens: 12_000,
      }),
    ).toEqual([
      '- fixed prompt overhead is ~12,000 tokens (workspace bootstrap context + skills) and already uses the whole 8,000 token prompt budget for "local/qwen3". Every turn is an overflow before any transcript is added, so compaction cannot free space. Raise the model contextWindow, trim the workspace bootstrap files/skills, or lower the reserve.',
    ]);
  });

  it("warns when overhead plus keepRecentTokens exceed the prompt budget", () => {
    expect(
      buildPromptBudgetDoctorAdvice({
        contextWindowTokens: 16_384,
        modelKey: "local/qwen3",
        reserveTokens: 8_384,
        configuredKeepRecentTokens: 4_000,
        fixedOverheadTokens: 5_000,
      }),
    ).toEqual([
      '- fixed prompt overhead (~5,000 tokens) plus compaction.keepRecentTokens (4,000 tokens) exceed the 8,000 token prompt budget for "local/qwen3". Compaction would keep more recent tokens than fit, so the overflow returns on the next turn. Lower agents.defaults.compaction.keepRecentTokens to below 3,000, or raise the model contextWindow.',
    ]);
  });

  it("warns when the reserve consumes the whole context window", () => {
    expect(
      buildPromptBudgetDoctorAdvice({
        contextWindowTokens: 4_096,
        modelKey: "local/tiny",
        reserveTokens: 6_000,
      }),
    ).toEqual([
      '- reserve 6,000 meets or exceeds the 4,096 token context window of "local/tiny"; no prompt budget remains for the transcript. Lower agents.defaults.compaction.reserveTokens/reserveTokensFloor or raise the model contextWindow.',
    ]);
  });

  it("ignores an unresolved context window", () => {
    expect(
      buildPromptBudgetDoctorAdvice({
        contextWindowTokens: 0,
        modelKey: "local/tiny",
        reserveTokens: 1_000,
        configuredKeepRecentTokens: 5_000,
        deep: true,
      }),
    ).toEqual([]);
  });
});
