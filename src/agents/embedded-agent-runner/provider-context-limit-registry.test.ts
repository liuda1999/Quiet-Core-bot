/** Tests learned provider context limits used for compaction/budget thresholds. */
import { afterEach, describe, expect, it } from "vitest";
import {
  clampContextBudgetWithLearnedLimit,
  recordProviderContextLimit,
  resetLearnedProviderContextLimitsForTest,
} from "./provider-context-limit-registry.js";

afterEach(() => {
  resetLearnedProviderContextLimitsForTest();
});

describe("provider context limit registry", () => {
  it("clamps the budget to the provider-stated limit after an over-declaration", () => {
    expect(
      recordProviderContextLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        statedLimitTokens: 131_072,
        declaredContextWindow: 524_288,
      }),
    ).toBe(true);

    expect(
      clampContextBudgetWithLearnedLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        declaredContextWindowTokens: 524_288,
      }),
    ).toEqual({ tokens: 131_072, learnedLimitTokens: 131_072 });
  });

  it("leaves the declared budget untouched when nothing was learned", () => {
    expect(
      clampContextBudgetWithLearnedLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        declaredContextWindowTokens: 524_288,
      }),
    ).toEqual({ tokens: 524_288 });
  });

  it("ignores under-declarations so a smaller declaration is not raised", () => {
    expect(
      recordProviderContextLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        statedLimitTokens: 524_288,
        declaredContextWindow: 131_072,
      }),
    ).toBe(false);

    expect(
      clampContextBudgetWithLearnedLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        declaredContextWindowTokens: 131_072,
      }),
    ).toEqual({ tokens: 131_072 });
  });

  it("keeps learned limits scoped to the provider and model", () => {
    recordProviderContextLimit({
      provider: "localapi",
      modelId: "qwen3-27b",
      statedLimitTokens: 131_072,
      declaredContextWindow: 524_288,
    });

    expect(
      clampContextBudgetWithLearnedLimit({
        provider: "localapi",
        modelId: "other-model",
        declaredContextWindowTokens: 524_288,
      }),
    ).toEqual({ tokens: 524_288 });
    expect(
      clampContextBudgetWithLearnedLimit({
        provider: "other-provider",
        modelId: "qwen3-27b",
        declaredContextWindowTokens: 524_288,
      }),
    ).toEqual({ tokens: 524_288 });
  });

  it("matches provider and model case-insensitively", () => {
    recordProviderContextLimit({
      provider: "LocalAPI",
      modelId: "Qwen3-27B",
      statedLimitTokens: 32_768,
      declaredContextWindow: 65_536,
    });

    expect(
      clampContextBudgetWithLearnedLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        declaredContextWindowTokens: 65_536,
      }),
    ).toEqual({ tokens: 32_768, learnedLimitTokens: 32_768 });
  });

  it("ignores non-finite and non-positive limits", () => {
    expect(
      recordProviderContextLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        statedLimitTokens: Number.NaN,
        declaredContextWindow: 65_536,
      }),
    ).toBe(false);
    expect(
      recordProviderContextLimit({
        provider: "localapi",
        modelId: "qwen3-27b",
        statedLimitTokens: 0,
        declaredContextWindow: 65_536,
      }),
    ).toBe(false);
  });
});
