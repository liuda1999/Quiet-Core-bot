// Implements docs link/search output for `quiet-core-bot docs`.
import fs from "node:fs";
import path from "node:path";
import { formatDocsLink, resolveDocsUrl } from "../../packages/terminal-core/src/links.js";
import { isRich, theme } from "../../packages/terminal-core/src/theme.js";
import { resolveQuietCoreReferencePaths } from "../agents/docs-path.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { RuntimeEnv } from "../runtime.js";

const SEARCH_RESULT_LIMIT = 10;
const SNIPPET_LENGTH = 160;
const MARKDOWN_EXTENSION = /\.mdx?$/u;

type DocResult = {
  title: string;
  link: string;
  snippet?: string;
};

function escapeMarkdown(text: string): string {
  return text.replace(/[()[\]]/g, "\\$&");
}

function buildMarkdown(query: string, results: DocResult[]): string {
  const lines: string[] = [`# Docs search: ${escapeMarkdown(query)}`, ""];
  if (results.length === 0) {
    lines.push("_No results._");
    return lines.join("\n");
  }
  for (const item of results) {
    const title = escapeMarkdown(item.title);
    const snippet = item.snippet ? escapeMarkdown(item.snippet) : "";
    const suffix = snippet ? ` - ${snippet}` : "";
    lines.push(`- [${title}](${item.link})${suffix}`);
  }
  return lines.join("\n");
}

function formatLinkLabel(link: string): string {
  return link.replace(/^https?:\/\//i, "");
}

function renderRichResults(query: string, results: DocResult[], runtime: RuntimeEnv) {
  runtime.log(`${theme.heading("Docs search:")} ${theme.info(query)}`);
  if (results.length === 0) {
    runtime.log(theme.muted("No results."));
    return;
  }
  for (const item of results) {
    const linkLabel = formatLinkLabel(item.link);
    const link = formatDocsLink(item.link, linkLabel);
    runtime.log(
      `${theme.muted("-")} ${theme.command(item.title)} ${theme.muted("(")}${link}${theme.muted(")")}`,
    );
    if (item.snippet) {
      runtime.log(`  ${theme.muted(item.snippet)}`);
    }
  }
}

async function renderMarkdown(markdown: string, runtime: RuntimeEnv) {
  runtime.log(markdown.trimEnd());
}

/** Recursively collect Markdown file paths (relative to the docs root). */
function collectMarkdownFiles(docsDir: string, relativeDir = ""): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(docsDir, relativeDir), { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(docsDir, relativePath));
      continue;
    }
    if (entry.isFile() && MARKDOWN_EXTENSION.test(entry.name)) {
      results.push(relativePath);
    }
  }
  return results;
}

function extractTitle(content: string, route: string): string {
  const match = content.match(/^#\s+(.+)$/mu);
  return match ? match[1].trim() : route;
}

function extractSnippet(content: string, terms: string[]): string | undefined {
  for (const line of content.split(/\r?\n/u)) {
    const normalized = line
      .replace(/[#*_`>]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (normalized.length < 4) {
      continue;
    }
    const lower = normalized.toLowerCase();
    if (terms.some((term) => lower.includes(term))) {
      return normalized.length > SNIPPET_LENGTH
        ? `${normalized.slice(0, SNIPPET_LENGTH)}…`
        : normalized;
    }
  }
  return undefined;
}

/** Search the local `docs/` Markdown sources bundled with the checkout. */
export function searchDocsDirectory(docsDir: string, query: string): DocResult[] {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }
  const scored: Array<{ score: number; item: DocResult }> = [];
  for (const relativePath of collectMarkdownFiles(docsDir)) {
    let content: string;
    try {
      content = fs.readFileSync(path.join(docsDir, relativePath), "utf8");
    } catch {
      continue;
    }
    const route = `/${relativePath.split(path.sep).join("/").replace(MARKDOWN_EXTENSION, "")}`;
    const lowerRoute = route.toLowerCase();
    const lowerContent = content.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (lowerRoute.endsWith(`/${term}`) || lowerRoute.endsWith(`/${term}.md`)) {
        score += 6;
      } else if (lowerRoute.includes(term)) {
        score += 4;
      }
      if (lowerContent.includes(term)) {
        score += 1;
      }
    }
    if (score <= 0) {
      continue;
    }
    scored.push({
      score,
      item: {
        title: extractTitle(content, route),
        link: resolveDocsUrl(route),
        snippet: extractSnippet(content, terms),
      },
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, SEARCH_RESULT_LIMIT).map((entry) => entry.item);
}

async function resolveLocalDocsPath(): Promise<string | null> {
  const { docsPath } = await resolveQuietCoreReferencePaths({
    cwd: process.cwd(),
    argv1: process.argv[1],
    moduleUrl: import.meta.url,
  });
  return docsPath;
}

async function searchDocs(query: string): Promise<DocResult[]> {
  const docsDir = await resolveLocalDocsPath();
  if (!docsDir) {
    throw new Error("local docs directory not found; run from a source checkout with `docs/`");
  }
  return searchDocsDirectory(docsDir, query);
}

/** Search the local docs sources, or print the docs homepage when no query is provided. */
export async function docsSearchCommand(queryParts: string[], runtime: RuntimeEnv) {
  const query = queryParts.join(" ").trim();
  if (!query) {
    const docs = formatDocsLink("/", "docs");
    if (isRich()) {
      runtime.log(`${theme.muted("Docs:")} ${docs}`);
      runtime.log(
        `${theme.muted("Search:")} ${formatCliCommand('quiet-core-bot docs "your query"')}`,
      );
    } else {
      runtime.log(`Docs: ${resolveDocsUrl("/")}`);
      runtime.log(`Search: ${formatCliCommand('quiet-core-bot docs "your query"')}`);
    }
    return;
  }

  let results: DocResult[];
  try {
    results = await searchDocs(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtime.error(`Docs search failed: ${message}`);
    runtime.exit(1);
    return;
  }

  if (isRich()) {
    renderRichResults(query, results, runtime);
    return;
  }
  const markdown = buildMarkdown(query, results);
  await renderMarkdown(markdown, runtime);
}
