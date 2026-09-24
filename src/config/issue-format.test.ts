// Covers config validation issue formatting for user-facing output.
import { describe, expect, it } from "vitest";
import {
  formatConfigIssueLine,
  formatConfigIssueLines,
  formatConfigIssueSummary,
  normalizeConfigIssue,
  normalizeConfigIssuePath,
  normalizeConfigIssues,
  resolveConfigIssuePathLabel,
} from "./issue-format.js";

describe("config issue format", () => {
  it("normalizes empty paths to <root>", () => {
    expect(normalizeConfigIssuePath("")).toBe("<root>");
    expect(normalizeConfigIssuePath("   ")).toBe("<root>");
    expect(normalizeConfigIssuePath(null)).toBe("<root>");
    expect(normalizeConfigIssuePath(undefined)).toBe("<root>");
  });

  it("formats issue lines with and without markers", () => {
    expect(formatConfigIssueLine({ path: "", message: "broken" }, "-")).toBe("- : broken");
    expect(
      formatConfigIssueLine({ path: "", message: "broken" }, "-", { normalizeRoot: true }),
    ).toBe("- <root>: broken");
    expect(formatConfigIssueLine({ path: "gateway.bind", message: "invalid" }, "")).toBe(
      "gateway.bind: invalid",
    );
    expect(
      formatConfigIssueLines(
        [
          { path: "", message: "first" },
          { path: "channels.signal.dmPolicy", message: "second" },
        ],
        "×",
        { normalizeRoot: true },
      ),
    ).toEqual(["× <root>: first", "× channels.signal.dmPolicy: second"]);
  });

  it("sanitizes control characters and ANSI sequences in formatted lines", () => {
    expect(
      formatConfigIssueLine(
        {
          path: "gateway.\nbind\x1b[31m",
          message: "bad\r\n\tvalue\x1b[0m\u0007",
        },
        "-",
      ),
    ).toBe("- gateway.\\nbind: bad\\r\\n\\tvalue");
  });

  it("A11: points an unrecognized-key issue at the rejected key, not just its parent", () => {
    // `config set <path>` must name the key the operator typed; the parent object alone is not
    // actionable (the shipped bundle also loses Zod's own locale message text).
    expect(
      formatConfigIssueLine({
        path: "tools.loopDetection.singleStepConcurrent",
        message: 'Unrecognized key: "warningThreshold"',
      }),
    ).toBe(
      '- tools.loopDetection.singleStepConcurrent.warningThreshold: Unrecognized key: "warningThreshold"',
    );
    expect(
      resolveConfigIssuePathLabel({
        path: "tools.loopDetection.singleStepConcurrent",
        message: 'Unrecognized key: "warningThreshold"',
      }),
    ).toBe("tools.loopDetection.singleStepConcurrent.warningThreshold");
    expect(
      formatConfigIssueLine({
        path: "",
        message: 'must not have additional properties: "warningThreshold"',
      }),
    ).toBe('- warningThreshold: must not have additional properties: "warningThreshold"');
  });

  it("A11: keeps the parent path when several keys (or none) are named", () => {
    expect(
      formatConfigIssueLine({
        path: "agents.defaults",
        message: 'Unrecognized keys: "alpha", "beta"',
      }),
    ).toBe('- agents.defaults: Unrecognized keys: "alpha", "beta"');
    expect(formatConfigIssueLine({ path: "agents.defaults", message: "Invalid input" })).toBe(
      "- agents.defaults: Invalid input",
    );
  });

  it("formats concise issue summaries", () => {
    expect(formatConfigIssueSummary([])).toBeNull();
    expect(
      formatConfigIssueSummary(
        [
          { path: "", message: "root broken" },
          { path: "gateway.auth.password.source", message: "Required" },
          { path: "agents.defaults.execution", message: "Unrecognized key" },
        ],
        { maxIssues: 2 },
      ),
    ).toBe("<root>: root broken; gateway.auth.password.source: Required; and 1 more");
  });

  it("normalizes issue metadata for machine output", () => {
    expect(
      normalizeConfigIssue({
        path: "",
        message: "invalid",
        allowedValues: ["stable", "beta"],
        allowedValuesHiddenCount: 0,
      }),
    ).toEqual({
      path: "<root>",
      message: "invalid",
      allowedValues: ["stable", "beta"],
    });

    expect(
      normalizeConfigIssues([
        {
          path: "update.channel",
          message: "invalid",
          allowedValues: [],
          allowedValuesHiddenCount: 2,
        },
      ]),
    ).toEqual([
      {
        path: "update.channel",
        message: "invalid",
      },
    ]);

    expect(
      normalizeConfigIssue({
        path: "update.channel",
        message: "invalid",
        allowedValues: ["stable"],
        allowedValuesHiddenCount: 2,
      }),
    ).toEqual({
      path: "update.channel",
      message: "invalid",
      allowedValues: ["stable"],
      allowedValuesHiddenCount: 2,
    });
  });
});
