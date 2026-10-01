// Tests npm registry spec parsing for packages, tags, and versions.
import { describe, expect, it } from "vitest";
import {
  compareQuietCoreReleaseVersions,
  formatPrereleaseResolutionError,
  isExactSemverVersion,
  isQuietCoreOrgNpmSpec,
  isQuietCoreStableCorrectionVersion,
  isPrereleaseSemverVersion,
  isPrereleaseResolutionAllowed,
  parseRegistryNpmSpec,
  validateRegistryNpmSpec,
} from "./npm-registry-spec.js";

function parseSpecOrThrow(spec: string) {
  const parsed = parseRegistryNpmSpec(spec);
  if (parsed === null) {
    throw new Error(`Expected ${spec} to parse`);
  }
  return parsed;
}

describe("npm registry spec validation", () => {
  it.each([
    "@quiet-core/voice-call",
    "@quiet-core/voice-call@1.2.3",
    "@quiet-core/voice-call@1.2.3-beta.4",
    "@quiet-core/voice-call@latest",
    "@quiet-core/voice-call@beta",
  ])("accepts %s", (spec) => {
    expect(validateRegistryNpmSpec(spec)).toBeNull();
  });

  it.each([
    {
      spec: "@quiet-core/voice-call@^1.2.3",
      expected: "exact version or dist-tag",
    },
    {
      spec: "@quiet-core/voice-call@~1.2.3",
      expected: "exact version or dist-tag",
    },
    {
      spec: "https://npmjs.org/pkg.tgz",
      expected: "URLs are not allowed",
    },
    {
      spec: "git+ssh://github.com/liuda1999/Quiet-Core-bot",
      expected: "URLs are not allowed",
    },
    {
      spec: "@quiet-core/voice-call@",
      expected: "missing version/tag after @",
    },
    {
      spec: "@quiet-core/voice-call@../beta",
      expected: "invalid version/tag",
    },
  ])("rejects %s", ({ spec, expected }) => {
    expect(validateRegistryNpmSpec(spec)).toContain(expected);
  });
});

describe("npm registry spec parsing helpers", () => {
  it.each([
    {
      spec: "@quiet-core/voice-call",
      expected: {
        name: "@quiet-core/voice-call",
        raw: "@quiet-core/voice-call",
        selectorKind: "none",
        selectorIsPrerelease: false,
      },
    },
    {
      spec: "@quiet-core/voice-call@beta",
      expected: {
        name: "@quiet-core/voice-call",
        raw: "@quiet-core/voice-call@beta",
        selector: "beta",
        selectorKind: "tag",
        selectorIsPrerelease: false,
      },
    },
    {
      spec: "@quiet-core/voice-call@2026.5.3-1",
      expected: {
        name: "@quiet-core/voice-call",
        raw: "@quiet-core/voice-call@2026.5.3-1",
        selector: "2026.5.3-1",
        selectorKind: "exact-version",
        selectorIsPrerelease: false,
      },
    },
    {
      // F-13: an ordinary semver must be recognized as an exact version, not a tag.
      spec: "@quiet-core/voice-call@0.1.0",
      expected: {
        name: "@quiet-core/voice-call",
        raw: "@quiet-core/voice-call@0.1.0",
        selector: "0.1.0",
        selectorKind: "exact-version",
        selectorIsPrerelease: false,
      },
    },
    {
      spec: "@quiet-core/voice-call@1.2.3",
      expected: {
        name: "@quiet-core/voice-call",
        raw: "@quiet-core/voice-call@1.2.3",
        selector: "1.2.3",
        selectorKind: "exact-version",
        selectorIsPrerelease: false,
      },
    },
    {
      // The year/month/patch monthly shape stays an exact version after the
      // exact-semver check.
      spec: "@quiet-core/voice-call@2026.5.3",
      expected: {
        name: "@quiet-core/voice-call",
        raw: "@quiet-core/voice-call@2026.5.3",
        selector: "2026.5.3",
        selectorKind: "exact-version",
        selectorIsPrerelease: false,
      },
    },
    {
      spec: "@quiet-core/voice-call@1.2.3-beta.1",
      expected: {
        name: "@quiet-core/voice-call",
        raw: "@quiet-core/voice-call@1.2.3-beta.1",
        selector: "1.2.3-beta.1",
        selectorKind: "exact-version",
        selectorIsPrerelease: true,
      },
    },
  ])("parses %s", ({ spec, expected }) => {
    expect(parseRegistryNpmSpec(spec)).toEqual(expected);
  });

  it.each([
    { spec: "@quiet-core/voice-call", expected: true },
    { spec: "@quiet-core/voice-call@1.2.3", expected: true },
    { spec: "@other/voice-call", expected: false },
    { spec: "voice-call", expected: false },
    { spec: "npm:@quiet-core/voice-call", expected: false },
    { spec: undefined, expected: false },
  ])("detects Quiet Core bot-org npm specs for %s", ({ spec, expected }) => {
    expect(isQuietCoreOrgNpmSpec(spec)).toBe(expected);
  });

  it.each([
    { value: "v1.2.3", expected: true },
    { value: "1.2", expected: false },
  ])("detects exact semver versions for %s", ({ value, expected }) => {
    expect(isExactSemverVersion(value)).toBe(expected);
  });

  it.each([
    { value: "1.2.3-beta.1", expected: true },
    { value: "1.2.3-1", expected: true },
    { value: "2026.5.3-beta.1", expected: true },
    { value: "2026.5.3-1", expected: false },
    { value: "2026.2.30-1", expected: false },
    { value: "1.2.3", expected: false },
  ])("detects prerelease semver versions for %s", ({ value, expected }) => {
    expect(isPrereleaseSemverVersion(value)).toBe(expected);
  });

  it.each([
    { value: "2026.5.3-1", expected: true },
    { value: "2026.5.3-2", expected: true },
    { value: "2026.5.3-beta.1", expected: false },
    { value: "1.2.3-1", expected: false },
    { value: "2026.2.30-1", expected: true },
  ])("detects Quiet Core bot stable correction versions for %s", ({ value, expected }) => {
    expect(isQuietCoreStableCorrectionVersion(value)).toBe(expected);
  });

  it.each([
    { left: "2026.5.3-1", right: "2026.5.3", expected: 1 },
    { left: "2026.5.3-2", right: "2026.5.3-1", expected: 1 },
    { left: "2026.5.3", right: "2026.5.3-beta.3", expected: 1 },
    { left: "2026.5.3-beta.3", right: "2026.5.3-alpha.9", expected: 1 },
    { left: "1.2.3-1", right: "1.2.3", expected: null },
  ])("compares Quiet Core bot release versions for %s and %s", ({ left, right, expected }) => {
    expect(compareQuietCoreReleaseVersions(left, right)).toBe(expected);
  });
});

describe("npm prerelease resolution policy", () => {
  it.each([
    {
      spec: "@quiet-core/voice-call",
      resolvedVersion: "1.2.3-beta.1",
      expected: false,
    },
    {
      spec: "@quiet-core/voice-call@latest",
      resolvedVersion: "1.2.3-rc.1",
      expected: false,
    },
    {
      spec: "@quiet-core/voice-call@latest",
      resolvedVersion: "2026.5.3-1",
      expected: true,
    },
    {
      spec: "@quiet-core/voice-call@beta",
      resolvedVersion: "1.2.3-beta.4",
      expected: true,
    },
    {
      spec: "@quiet-core/voice-call@1.2.3-beta.1",
      resolvedVersion: "1.2.3-beta.1",
      expected: true,
    },
    {
      spec: "@quiet-core/voice-call",
      resolvedVersion: "1.2.3",
      expected: true,
    },
    {
      spec: "@quiet-core/voice-call@latest",
      resolvedVersion: undefined,
      expected: true,
    },
  ])("decides prerelease resolution for %s -> %s", ({ spec, resolvedVersion, expected }) => {
    expect(
      isPrereleaseResolutionAllowed({
        spec: parseSpecOrThrow(spec),
        resolvedVersion,
      }),
    ).toBe(expected);
  });

  it.each([
    {
      spec: "@quiet-core/voice-call",
      resolvedVersion: "1.2.3-beta.1",
      expected: `Use "@quiet-core/voice-call@beta"`,
    },
    {
      spec: "@quiet-core/voice-call@beta",
      resolvedVersion: "1.2.3-rc.1",
      expected: "Use an explicit prerelease tag or exact prerelease version",
    },
  ])("formats prerelease guidance for %s", ({ spec, resolvedVersion, expected }) => {
    expect(
      formatPrereleaseResolutionError({
        spec: parseSpecOrThrow(spec),
        resolvedVersion,
      }),
    ).toContain(expected);
  });
});
