// Terminal Core module implements links behavior.
import { formatTerminalLink } from "./terminal-link.js";

const DOCS_REPO_URL = "https://github.com/liuda1999/Quiet-Core-bot";
// Docs live in the repository under `docs/`. Link to the rendered GitHub views so
// the links stay valid without a hosted docs site.
const DOCS_TREE_ROOT = `${DOCS_REPO_URL}/tree/main/docs`;
const DOCS_BLOB_ROOT = `${DOCS_REPO_URL}/blob/main/docs`;

function resolveDocsRoot(): string {
  return DOCS_TREE_ROOT;
}

/** Map a docs route (e.g. `/cli/acp`) to its Markdown source path under `docs/`. */
function toDocsSourcePath(route: string): string {
  const hashIndex = route.indexOf("#");
  const rawBase = hashIndex === -1 ? route : route.slice(0, hashIndex);
  const anchor = hashIndex === -1 ? "" : route.slice(hashIndex);
  const base = rawBase.replace(/\/+$/u, "");
  if (!base) {
    return anchor;
  }
  return /\.mdx?$/iu.test(base) ? `${base}${anchor}` : `${base}.md${anchor}`;
}

/** Resolve a docs route to an absolute URL pointing at the repository docs. */
export function resolveDocsUrl(path: string | undefined | null): string {
  const trimmed = typeof path === "string" ? path.trim() : "";
  if (!trimmed) {
    return resolveDocsRoot();
  }
  if (trimmed.startsWith("http")) {
    return trimmed;
  }
  const route = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (route === "/") {
    return resolveDocsRoot();
  }
  return `${DOCS_BLOB_ROOT}${toDocsSourcePath(route)}`;
}

export function formatDocsLink(
  path: string | undefined | null,
  label?: string,
  opts?: { fallback?: string; force?: boolean },
): string {
  // When a caller has no docsPath, link to the docs root rather than crashing
  // the onboarding/channel-selection flows that pass meta.docsPath through
  // here unguarded. The typed contract says docsPath is required, but a
  // handful of channel plugins and catalog rows leave it unset at runtime.
  const url = resolveDocsUrl(path);
  return formatTerminalLink(label ?? url, url, {
    fallback: opts?.fallback ?? url,
    force: opts?.force,
  });
}
