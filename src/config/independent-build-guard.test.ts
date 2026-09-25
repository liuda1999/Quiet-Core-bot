// Verifies the independent-build guard that refuses upstream update commands.
import { describe, expect, it } from "vitest";
import {
  INDEPENDENT_BUILD_ENV_KEY,
  IndependentBuildUpdateError,
  assertUpstreamUpdateAllowed,
  formatIndependentBuildUpdateMessage,
  isIndependentBuild,
} from "./independent-build-guard.js";

describe("independent build update guard", () => {
  it("treats unset, empty, and unrecognized values as an independent build", () => {
    expect(isIndependentBuild({})).toBe(true);
    expect(isIndependentBuild({ [INDEPENDENT_BUILD_ENV_KEY]: "" })).toBe(true);
    expect(isIndependentBuild({ [INDEPENDENT_BUILD_ENV_KEY]: "   " })).toBe(true);
    expect(isIndependentBuild({ [INDEPENDENT_BUILD_ENV_KEY]: "maybe" })).toBe(true);
    expect(isIndependentBuild({ [INDEPENDENT_BUILD_ENV_KEY]: "1" })).toBe(true);
  });

  it("restores the upstream update flow for the documented opt-out values", () => {
    for (const value of ["0", "false", "off", "no", "FALSE", " Off "]) {
      expect(isIndependentBuild({ [INDEPENDENT_BUILD_ENV_KEY]: value })).toBe(false);
    }
  });

  it("refuses mutating update commands with an actionable message", () => {
    expect(() => assertUpstreamUpdateAllowed({})).toThrow(IndependentBuildUpdateError);

    const message = formatIndependentBuildUpdateMessage();
    expect(message).toContain("does not participate in upstream Quiet Core bot updates");
    expect(message).toContain("quiet-core-bot update status");
    expect(message).toContain(`${INDEPENDENT_BUILD_ENV_KEY}=0`);
  });

  it("allows updates once the guard is opted out", () => {
    expect(() => assertUpstreamUpdateAllowed({ [INDEPENDENT_BUILD_ENV_KEY]: "0" })).not.toThrow();
  });
});
