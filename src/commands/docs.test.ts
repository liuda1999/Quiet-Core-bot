// Docs command tests cover local docs search, fallbacks, and runtime output.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";

const resolveQuietCoreReferencePaths = vi.hoisted(() => vi.fn());

vi.mock("../../packages/terminal-core/src/theme.js", () => ({
  isRich: () => false,
  theme: {
    heading: (s: string) => s,
    info: (s: string) => s,
    muted: (s: string) => s,
    command: (s: string) => s,
  },
}));

vi.mock("../../packages/terminal-core/src/links.js", () => ({
  formatDocsLink: (p: string, label?: string) => `${label ?? ""}${p}`,
  resolveDocsUrl: (p: string | undefined | null) => {
    const trimmed = typeof p === "string" ? p.trim() : "";
    if (!trimmed || trimmed === "/") {
      return "https://example.test/tree/main/docs";
    }
    return `https://example.test/blob/main/docs${trimmed}.md`;
  },
}));

vi.mock("../cli/command-format.js", () => ({
  formatCliCommand: (s: string) => s,
}));

vi.mock("../agents/docs-path.js", () => ({
  resolveQuietCoreReferencePaths,
}));

const { docsSearchCommand, searchDocsDirectory } = await import("./docs.js");

function makeRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } as unknown as RuntimeEnv & {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    exit: ReturnType<typeof vi.fn>;
  };
}

let tmpRoot: string;
let docsDir: string;

function writeDoc(relativePath: string, content: string) {
  const target = path.join(docsDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

beforeEach(() => {
  resolveQuietCoreReferencePaths.mockReset();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qcb-docs-"));
  docsDir = path.join(tmpRoot, "docs");
  writeDoc("tools/web.md", "# Web tools\n\nUse the web tool to fetch pages.\n");
  writeDoc("cli/onboard.md", "# Onboard\n\nRun onboarding to configure the gateway.\n");
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("searchDocsDirectory", () => {
  it("finds a doc by route and content and returns an absolute link", () => {
    const results = searchDocsDirectory(docsDir, "web");

    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.title).toBe("Web tools");
    expect(top.link).toBe("https://example.test/blob/main/docs/tools/web.md");
  });

  it("returns no results for an unmatched query", () => {
    expect(searchDocsDirectory(docsDir, "zzzznotfoundzzzz")).toEqual([]);
  });
});

describe("docsSearchCommand", () => {
  it("prints the docs root when no query is provided", async () => {
    const runtime = makeRuntime();

    await docsSearchCommand([], runtime);

    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("tree/main/docs"));
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it("renders local search results without failing", async () => {
    resolveQuietCoreReferencePaths.mockResolvedValueOnce({ docsPath: docsDir, sourcePath: null });
    const runtime = makeRuntime();

    await docsSearchCommand(["onboard"], runtime);

    expect(runtime.error).not.toHaveBeenCalled();
    expect(runtime.exit).not.toHaveBeenCalled();
    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("Onboard"));
  });

  it("fails loudly when no local docs directory is available", async () => {
    resolveQuietCoreReferencePaths.mockResolvedValueOnce({ docsPath: null, sourcePath: null });
    const runtime = makeRuntime();

    await docsSearchCommand(["browser"], runtime);

    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("local docs directory not found"),
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });
});
