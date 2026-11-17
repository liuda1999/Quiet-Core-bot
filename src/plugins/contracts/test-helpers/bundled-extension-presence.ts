/**
 * Presence checks for bundled extensions in this trimmed source checkout.
 *
 * This deployment intentionally ships without a set of upstream cloud
 * channel/provider extensions. Contract tests must still assert invariants, so
 * they filter their fixtures down to the extensions that actually ship while
 * failing loudly when an extension disappears without being declared trimmed.
 */
import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const EXTENSIONS_ROOT = resolve(REPO_ROOT, "extensions");

/**
 * Bundled extensions intentionally absent from this checkout.
 *
 * Add an id here only when the trim is deliberate. An extension that is
 * missing without an entry here is treated as a regression by
 * {@link filterPresentBundledExtensions}.
 */
export const TRIMMED_BUNDLED_EXTENSION_IDS: ReadonlySet<string> = new Set([
  "alibaba",
  "amazon-bedrock",
  "amazon-bedrock-mantle",
  "anthropic",
  "brave",
  "byteplus",
  "codex",
  "deepgram",
  "deepinfra",
  "discord",
  "duckduckgo",
  "elevenlabs",
  "exa",
  "fal",
  "feishu",
  "github-copilot",
  "google",
  "google-meet",
  "googlechat",
  "gradium",
  "groq",
  "imessage",
  "line",
  "microsoft",
  "minimax",
  "mistral",
  "moonshot",
  "msteams",
  "nvidia",
  "openai",
  "opencode",
  "opencode-go",
  "openrouter",
  "openshell",
  "parallel",
  "perplexity",
  "pixverse",
  "qqbot",
  "qwen",
  "runway",
  "slack",
  "tavily",
  "telegram",
  "together",
  "twitch",
  "voice-call",
  "voyage",
  "vydra",
  "whatsapp",
  "xai",
  "zai",
  "zalo",
  "zalouser",
]);

const presenceCache = new Map<string, boolean>();

/** Returns true when this checkout ships the bundled extension directory. */
export function isBundledExtensionPresent(extensionId: string): boolean {
  const cached = presenceCache.get(extensionId);
  if (cached !== undefined) {
    return cached;
  }
  const present = fs.existsSync(resolve(EXTENSIONS_ROOT, extensionId));
  presenceCache.set(extensionId, present);
  return present;
}

/**
 * Filters fixtures down to extensions that ship here.
 *
 * Throws when an absent extension is not listed in
 * {@link TRIMMED_BUNDLED_EXTENSION_IDS}, so an accidental deletion still fails
 * the contract instead of quietly shrinking coverage.
 */
export function filterPresentBundledExtensions<T extends string>(ids: readonly T[]): T[] {
  const unexpected = ids.filter(
    (id) => !isBundledExtensionPresent(id) && !TRIMMED_BUNDLED_EXTENSION_IDS.has(id),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Bundled extensions missing from this checkout but not declared trimmed: ${unexpected.join(", ")}. ` +
        "Add them to TRIMMED_BUNDLED_EXTENSION_IDS in src/plugins/contracts/test-helpers/bundled-extension-presence.ts " +
        "only if the removal is intentional.",
    );
  }
  return ids.filter((id) => isBundledExtensionPresent(id));
}

/** Extracts the extension id from a repo-relative path like `extensions/x/...`. */
function bundledExtensionIdFromRepoPath(relativePath: string): string | null {
  const normalized = relativePath.replaceAll("\\", "/");
  const match = /^extensions\/([^/]+)\//u.exec(normalized);
  return match?.[1] ?? null;
}

/**
 * Returns true when a repo-relative path belongs to a shipping bundled
 * extension. Paths outside `extensions/` always count as present.
 */
export function isPathOwnedByPresentBundledExtension(relativePath: string): boolean {
  const extensionId = bundledExtensionIdFromRepoPath(relativePath);
  return extensionId === null || isBundledExtensionPresent(extensionId);
}
