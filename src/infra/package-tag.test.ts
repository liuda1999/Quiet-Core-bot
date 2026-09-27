// Tests package tag parsing and stable release tag behavior.
import { describe, expect, it } from "vitest";
import { normalizePackageTagInput } from "./package-tag.js";

describe("normalizePackageTagInput", () => {
  const packageNames = ["quiet-core-bot", "@quiet-core/plugin"] as const;

  it.each([
    { input: undefined, expected: null },
    { input: "   ", expected: null },
    { input: "quiet-core-bot@beta", expected: "beta" },
    { input: "@quiet-core/plugin@2026.2.24", expected: "2026.2.24" },
    { input: "quiet-core-bot@   ", expected: null },
    { input: "quiet-core-bot", expected: null },
    { input: " @quiet-core/plugin ", expected: null },
    { input: " latest ", expected: "latest" },
    { input: "@other/plugin@beta", expected: "@other/plugin@beta" },
    { input: "quiet-core-boter@beta", expected: "quiet-core-boter@beta" },
  ] satisfies ReadonlyArray<{ input: string | undefined; expected: string | null }>)(
    "normalizes %j",
    ({ input, expected }) => {
      expect(normalizePackageTagInput(input, packageNames)).toBe(expected);
    },
  );
});
