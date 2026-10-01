// Frontmatter tests cover shared Markdown frontmatter parsing helpers.
import { describe, expect, it, test } from "vitest";
import {
  applyQuietCoreManifestInstallCommonFields,
  getFrontmatterString,
  normalizeStringList,
  parseFrontmatterBool,
  parseQuietCoreManifestInstallBase,
  resolveQuietCoreManifestBlock,
  resolveQuietCoreManifestInstall,
  resolveQuietCoreManifestOs,
  resolveQuietCoreManifestRequires,
} from "./frontmatter.js";

function expectInstallBase(
  parsed: ReturnType<typeof parseQuietCoreManifestInstallBase>,
): NonNullable<ReturnType<typeof parseQuietCoreManifestInstallBase>> {
  if (parsed === undefined) {
    throw new Error("Expected manifest install base");
  }
  return parsed;
}

describe("shared/frontmatter", () => {
  test("normalizeStringList handles strings, arrays, and non-list values", () => {
    expect(normalizeStringList("a, b,,c")).toEqual(["a", "b", "c"]);
    expect(normalizeStringList([" a ", "", "b", 42])).toEqual(["a", "b", "42"]);
    expect(normalizeStringList(null)).toStrictEqual([]);
  });

  test("getFrontmatterString extracts strings only", () => {
    expect(getFrontmatterString({ a: "b" }, "a")).toBe("b");
    expect(getFrontmatterString({ a: 1 }, "a")).toBeUndefined();
  });

  test("parseFrontmatterBool respects explicit values and fallback", () => {
    expect(parseFrontmatterBool("true", false)).toBe(true);
    expect(parseFrontmatterBool("false", true)).toBe(false);
    expect(parseFrontmatterBool(undefined, true)).toBe(true);
    expect(parseFrontmatterBool("maybe", false)).toBe(false);
  });

  test("resolveQuietCoreManifestBlock reads current manifest keys and custom metadata fields", () => {
    expect(
      resolveQuietCoreManifestBlock({
        frontmatter: {
          metadata: `{ "quiet-core-bot": { foo: 1, bar: 'baz' } }`,
        },
      }),
    ).toEqual({ foo: 1, bar: "baz" });

    expect(
      resolveQuietCoreManifestBlock({
        frontmatter: {
          pluginMeta: `{ "quiet-core-bot": { foo: 2 } }`,
        },
        key: "pluginMeta",
      }),
    ).toEqual({ foo: 2 });
  });

  test("resolveQuietCoreManifestBlock reads legacy manifest keys", () => {
    expect(
      resolveQuietCoreManifestBlock({
        frontmatter: {
          metadata: "{ clawdbot: { requires: { bins: ['op'] }, install: [] } }",
        },
      }),
    ).toEqual({ requires: { bins: ["op"] }, install: [] });
  });

  test("resolveQuietCoreManifestBlock prefers current manifest keys over legacy keys", () => {
    expect(
      resolveQuietCoreManifestBlock({
        frontmatter: {
          metadata: `{ "quiet-core-bot": { requires: { bins: ['current'] } }, clawdbot: { requires: { bins: ['legacy'] } } }`,
        },
      }),
    ).toEqual({ requires: { bins: ["current"] } });
  });

  test("resolveQuietCoreManifestBlock returns undefined for invalid input", () => {
    expect(resolveQuietCoreManifestBlock({ frontmatter: {} })).toBeUndefined();
    expect(
      resolveQuietCoreManifestBlock({ frontmatter: { metadata: "not-json5" } }),
    ).toBeUndefined();
    expect(resolveQuietCoreManifestBlock({ frontmatter: { metadata: "123" } })).toBeUndefined();
    expect(resolveQuietCoreManifestBlock({ frontmatter: { metadata: "[]" } })).toBeUndefined();
    expect(
      resolveQuietCoreManifestBlock({ frontmatter: { metadata: "{ nope: { a: 1 } }" } }),
    ).toBeUndefined();
  });

  it("normalizes manifest requirement and os lists", () => {
    expect(
      resolveQuietCoreManifestRequires({
        requires: {
          bins: "bun, node",
          anyBins: [" ffmpeg ", ""],
          env: ["QUIET_CORE_TOKEN", " QUIET_CORE_URL "],
          config: null,
        },
      }),
    ).toEqual({
      bins: ["bun", "node"],
      anyBins: ["ffmpeg"],
      env: ["QUIET_CORE_TOKEN", "QUIET_CORE_URL"],
      config: [],
    });
    expect(resolveQuietCoreManifestRequires({})).toBeUndefined();
    expect(resolveQuietCoreManifestOs({ os: [" darwin ", "linux", ""] })).toEqual([
      "darwin",
      "linux",
    ]);
  });

  it("parses and applies install common fields", () => {
    const parsed = parseQuietCoreManifestInstallBase(
      {
        type: " Brew ",
        id: "brew.git",
        label: "Git",
        bins: [" git ", "git"],
      },
      ["brew", "npm"],
    );

    expect(parsed).toEqual({
      raw: {
        type: " Brew ",
        id: "brew.git",
        label: "Git",
        bins: [" git ", "git"],
      },
      kind: "brew",
      id: "brew.git",
      label: "Git",
      bins: ["git", "git"],
    });
    expect(parseQuietCoreManifestInstallBase({ kind: "bad" }, ["brew"])).toBeUndefined();
    expect(
      applyQuietCoreManifestInstallCommonFields<{
        extra: boolean;
        id?: string;
        label?: string;
        bins?: string[];
      }>({ extra: true }, expectInstallBase(parsed)),
    ).toEqual({
      extra: true,
      id: "brew.git",
      label: "Git",
      bins: ["git", "git"],
    });
  });

  it("prefers explicit kind, ignores invalid common fields, and leaves missing ones untouched", () => {
    const parsed = parseQuietCoreManifestInstallBase(
      {
        kind: " npm ",
        type: "brew",
        id: 42,
        label: null,
        bins: [" ", ""],
      },
      ["brew", "npm"],
    );

    expect(parsed).toEqual({
      raw: {
        kind: " npm ",
        type: "brew",
        id: 42,
        label: null,
        bins: [" ", ""],
      },
      kind: "npm",
    });
    expect(
      applyQuietCoreManifestInstallCommonFields(
        { id: "keep", label: "Keep", bins: ["bun"] },
        parsed!,
      ),
    ).toEqual({
      id: "keep",
      label: "Keep",
      bins: ["bun"],
    });
  });

  it("maps install entries through the parser and filters rejected specs", () => {
    expect(
      resolveQuietCoreManifestInstall(
        {
          install: [{ id: "keep" }, { id: "drop" }, "bad"],
        },
        (entry) => {
          if (
            typeof entry === "object" &&
            entry !== null &&
            (entry as { id?: string }).id === "keep"
          ) {
            return { id: "keep" };
          }
          return undefined;
        },
      ),
    ).toEqual([{ id: "keep" }]);
  });
});
