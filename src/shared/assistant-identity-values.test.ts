// Assistant identity tests cover normalized assistant names and metadata values.
import { describe, expect, it } from "vitest";
import { coerceIdentityValue } from "./assistant-identity-values.js";

describe("shared/assistant-identity-values", () => {
  it("returns undefined for missing or blank values", () => {
    expect(coerceIdentityValue(undefined, 10)).toBeUndefined();
    expect(coerceIdentityValue("   ", 10)).toBeUndefined();
    expect(coerceIdentityValue(42 as unknown as string, 10)).toBeUndefined();
  });

  it("trims values and preserves strings within the limit", () => {
    expect(coerceIdentityValue("  QuietCore  ", 20)).toBe("QuietCore");
    expect(coerceIdentityValue("  QuietCore  ", 9)).toBe("QuietCore");
  });

  it("truncates overlong trimmed values at the exact limit", () => {
    expect(coerceIdentityValue("  QuietCore Assistant  ", 9)).toBe("QuietCore");
  });

  it("returns an empty string when truncating to a zero-length limit", () => {
    expect(coerceIdentityValue("  QuietCore  ", 0)).toBe("");
    expect(coerceIdentityValue("  QuietCore  ", -1)).toBe("QuietCor");
  });
});
