// Config path docs tests validate documented config path references.
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOCS_WITH_CONFIG_PATH_EXAMPLES = [
  "docs/cli/config.md",
  "docs/tools/exec.md",
  "docs/nodes/index.md",
];

const CONFIG_PATH_EXAMPLE_RE = /\bquiet-core-bot\s+config\s+(?:get|set|unset)\s+(\S+)/;

function findUnquotedBracketPathExamples(markdown: string, docPath: string): string[] {
  const failures: string[] = [];

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const match = line.match(CONFIG_PATH_EXAMPLE_RE);
    if (!match) {
      continue;
    }

    const pathArg = match[1];
    if (pathArg.includes("[") && !pathArg.startsWith("'") && !pathArg.startsWith('"')) {
      failures.push(`${docPath}:${index + 1}: ${pathArg}`);
    }
  }

  return failures;
}

describe("config path docs", () => {
  it("quotes bracket-notation config paths in shell examples", async () => {
    const failures: string[] = [];
    let exampleCount = 0;

    for (const docPath of DOCS_WITH_CONFIG_PATH_EXAMPLES) {
      const markdown = await fs.readFile(path.join(process.cwd(), docPath), "utf8");
      exampleCount += markdown
        .split(/\r?\n/)
        .filter((line) => CONFIG_PATH_EXAMPLE_RE.test(line)).length;
      failures.push(...findUnquotedBracketPathExamples(markdown, docPath));
    }

    // Keeps this check honest: if the pattern stops matching (for example after a
    // CLI rename), the suite should fail instead of silently scanning nothing.
    expect(exampleCount).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
