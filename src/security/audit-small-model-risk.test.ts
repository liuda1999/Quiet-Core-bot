// Covers small-model risk audit findings.
import { describe, expect, it } from "vitest";
import type { QuietCoreConfig } from "../config/config.js";
import { collectSmallModelRiskFindings } from "./audit-extra.summary.js";

function requireFirstSmallModelFinding(
  findings: ReturnType<typeof collectSmallModelRiskFindings>,
  label: string,
) {
  const [finding] = findings;
  if (!finding) {
    throw new Error(`Expected small-model risk finding for ${label}`);
  }
  return finding;
}

describe("security audit small-model risk findings", () => {
  it("scores small-model risk by tool/sandbox exposure", () => {
    const cases: Array<{
      name: string;
      cfg: QuietCoreConfig;
      expectedSeverity: "info" | "critical";
      detailIncludes: string[];
    }> = [
      {
        name: "small model with web and browser enabled",
        cfg: {
          agents: { defaults: { model: { primary: "ollama/mistral-8b" } } },
          tools: { web: { search: { enabled: true }, fetch: { enabled: true } } },
          browser: { enabled: true },
        },
        expectedSeverity: "critical",
        detailIncludes: ["mistral-8b", "web_search", "web_fetch", "browser"],
      },
      {
        name: "small model with sandbox all and web/browser disabled",
        cfg: {
          agents: {
            defaults: { model: { primary: "ollama/mistral-8b" }, sandbox: { mode: "all" } },
          },
          tools: { web: { search: { enabled: false }, fetch: { enabled: false } } },
          browser: { enabled: false },
        },
        expectedSeverity: "info",
        detailIncludes: ["mistral-8b", "sandbox=all"],
      },
    ];

    for (const testCase of cases) {
      const finding = requireFirstSmallModelFinding(
        collectSmallModelRiskFindings({
          cfg: testCase.cfg,
          env: process.env,
        }),
        testCase.name,
      );
      expect(finding.severity, testCase.name).toBe(testCase.expectedSeverity);
      for (const snippet of testCase.detailIncludes) {
        expect(finding.detail, `${testCase.name}:${snippet}`).toContain(snippet);
      }
    }
  });

  it("resolves configured aliases before parameter-size classification", () => {
    const finding = requireFirstSmallModelFinding(
      collectSmallModelRiskFindings({
        cfg: {
          agents: {
            defaults: {
              model: { primary: "tiny" },
              models: {
                "ollama/mistral-8b": { alias: "tiny" },
              },
            },
          },
          tools: { web: { search: { enabled: true }, fetch: { enabled: true } } },
          browser: { enabled: true },
        } satisfies QuietCoreConfig,
        env: {},
      }),
      "configured alias",
    );

    expect(finding.checkId).toBe("models.small_params");
    expect(finding.detail).toContain("ollama/mistral-8b");
    expect(finding.detail).toContain("@ agents.defaults.model.primary");
    expect(finding.detail).not.toContain("- tiny");
  });

  it("honors provider/model tool deny policy before reporting web exposure", () => {
    const finding = requireFirstSmallModelFinding(
      collectSmallModelRiskFindings({
        cfg: {
          agents: {
            defaults: {
              model: {
                primary: "openrouter/google/gemma-3-4b-it:free",
              },
            },
          },
          tools: {
            web: { search: { enabled: true }, fetch: { enabled: true } },
            byProvider: {
              "openrouter/google/gemma-3-4b-it:free": {
                deny: ["web_search", "web_fetch", "browser"],
              },
            },
          },
          browser: { enabled: true },
        } satisfies QuietCoreConfig,
        env: {},
      }),
      "provider/model deny",
    );

    expect(finding.checkId).toBe("models.small_params");
    expect(finding.severity).toBe("info");
    expect(finding.detail).toContain("openrouter/google/gemma-3-4b-it:free");
    expect(finding.detail).toContain("web=[off]");
    expect(finding.detail).toContain("No web/browser tools detected");
    expect(finding.detail).not.toContain("web=[web_search");
  });

  const localProviderConfig = {
    baseUrl: "http://192.168.0.108:23456/v1",
    models: [],
  };

  it("does not flag a user-selected local 27B default primary as critical", () => {
    const finding = requireFirstSmallModelFinding(
      collectSmallModelRiskFindings({
        cfg: {
          agents: {
            defaults: {
              model: { primary: "custom-192-168-0-108-23456/Qwen3.8-27B-UD-Q6_K_M.gguf" },
            },
          },
          models: {
            providers: { "custom-192-168-0-108-23456": localProviderConfig },
          },
          tools: { web: { search: { enabled: true }, fetch: { enabled: true } } },
          browser: { enabled: true },
        } satisfies QuietCoreConfig,
        env: {},
      }),
      "local 27B default primary",
    );

    expect(finding.checkId).toBe("models.small_params");
    expect(finding.severity).not.toBe("critical");
    expect(finding.severity).toBe("info");
    expect(finding.detail).toContain("Qwen3.8-27B-UD-Q6_K_M.gguf");
    expect(finding.detail).toContain("paramB=27B");
    expect(finding.detail).toContain("<= 300");
    expect(finding.detail).toContain("agents.defaults.model.primary");
    expect(finding.detail).toContain("info(local default)");
  });

  it("still flags a genuinely tiny 1B local default primary as critical", () => {
    const finding = requireFirstSmallModelFinding(
      collectSmallModelRiskFindings({
        cfg: {
          agents: {
            defaults: {
              model: { primary: "custom-192-168-0-108-23456/tiny-1b.gguf" },
            },
          },
          models: {
            providers: { "custom-192-168-0-108-23456": localProviderConfig },
          },
          tools: { web: { search: { enabled: true }, fetch: { enabled: true } } },
          browser: { enabled: true },
        } satisfies QuietCoreConfig,
        env: {},
      }),
      "local 1B default primary",
    );

    expect(finding.severity).toBe("critical");
    expect(finding.detail).toContain("paramB=1B");
    expect(finding.detail).toContain("tiny-1b.gguf");
  });
});
