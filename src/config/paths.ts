// Resolves config, state, cache, and runtime filesystem paths.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveHomeRelativePath, resolveRequiredHomeDir } from "../infra/home-dir.js";
import { LEGACY_STATE_DIR_NAME, renameLegacyStateDir } from "../infra/legacy-openclaw-migration.js";
import { parseTcpPort } from "../infra/tcp-port.js";
import type { QuietCoreConfig } from "./types.js";

/**
 * Nix mode detection: When QUIET_CORE_NIX_MODE=1, the gateway is running under Nix.
 * In this mode:
 * - No auto-install flows should be attempted
 * - Missing dependencies should produce actionable Nix-specific error messages
 * - Config is managed externally (read-only from Nix perspective)
 */
export function resolveIsNixMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.QUIET_CORE_NIX_MODE === "1";
}

export let isNixMode = resolveIsNixMode();

const STATE_DIR_NAME_VALUE = ".quiet-core-bot";
const CONFIG_FILENAME = "quiet-core-bot.json";

/** Home-relative name of the current state directory (`.quiet-core-bot`). */
export const STATE_DIR_NAME = STATE_DIR_NAME_VALUE;
/** File name of the current config inside the state directory. */
export const CONFIG_FILE_NAME = CONFIG_FILENAME;

function resolveDefaultHomeDir(): string {
  return resolveRequiredHomeDir(process.env, os.homedir);
}

/** Build a homedir thunk that respects QUIET_CORE_HOME for the given env. */
function envHomedir(env: NodeJS.ProcessEnv): () => string {
  return () => resolveRequiredHomeDir(env, os.homedir);
}

function newStateDir(homedir: () => string = resolveDefaultHomeDir): string {
  return path.join(homedir(), STATE_DIR_NAME_VALUE);
}

/**
 * State directory for mutable data (sessions, logs, caches).
 * Can be overridden via QUIET_CORE_STATE_DIR.
 * Default: ~/.quiet-core-bot
 */
export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const override = env.QUIET_CORE_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env, effectiveHomedir);
  }
  return newStateDir(effectiveHomedir);
}

export function normalizeStateDirEnv(env: NodeJS.ProcessEnv = process.env): void {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, envHomedir(env));
  const quietCoreBotOverride = env.QUIET_CORE_STATE_DIR?.trim();
  if (quietCoreBotOverride) {
    env.QUIET_CORE_STATE_DIR = resolveUserPath(quietCoreBotOverride, env, effectiveHomedir);
  }
}

function resolveUserPath(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  return resolveHomeRelativePath(input, { env, homedir });
}

/**
 * Optional allowlist of directories that `$include` directives may resolve
 * outside the config directory. Set via `QUIET_CORE_INCLUDE_ROOTS` as a
 * platform-delimited path list (`:` on POSIX, `;` on Windows).
 *
 * Each entry is tilde-expanded and resolved to an absolute path. Entries that
 * cannot be resolved or that are not absolute after expansion are dropped.
 *
 * Returns an empty array when the var is unset or contains no usable entries,
 * preserving the historical behavior where `$include` is confined to the
 * directory containing `quiet-core-bot.json`.
 */
export function resolveIncludeRoots(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string[] {
  const raw = env.QUIET_CORE_INCLUDE_ROOTS?.trim();
  if (!raw) {
    return [];
  }
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const entry of raw.split(path.delimiter)) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const resolved = path.resolve(
      resolveHomeRelativePath(trimmed, { env, homedir: effectiveHomedir }),
    );
    if (!path.isAbsolute(resolved) || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    roots.push(resolved);
  }
  return roots;
}

export let STATE_DIR = resolveStateDir();

/**
 * Config file path (JSON or JSON5).
 * Can be overridden via QUIET_CORE_CONFIG_PATH.
 * Default: ~/.quiet-core-bot/quiet-core-bot.json (or $QUIET_CORE_STATE_DIR/quiet-core-bot.json)
 */
export function resolveCanonicalConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  const override = env.QUIET_CORE_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, CONFIG_FILENAME);
}

/**
 * Resolve the active config path by preferring existing config candidates
 * before falling back to the canonical path.
 */
export function resolveConfigPathCandidate(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  if (env.QUIET_CORE_TEST_FAST === "1") {
    return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
  }
  const candidates = resolveDefaultConfigCandidates(env, homedir);
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) {
    return existing;
  }
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

/**
 * Active config path (prefers existing config files).
 */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
  homedir: () => string = envHomedir(env),
): string {
  const override = env.QUIET_CORE_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override, env, homedir);
  }
  return path.join(stateDir, CONFIG_FILENAME);
}

export let CONFIG_PATH = resolveConfigPathCandidate();

/**
 * Re-pins process-stable runtime paths after an early startup selector changes the environment.
 *
 * Gateway startup must call this before importing runtime modules that derive their own constants
 * from these live bindings, otherwise one process can split reads and writes across two targets.
 */
export function pinRuntimePaths(env: NodeJS.ProcessEnv = process.env): {
  configPath: string;
  stateDir: string;
} {
  normalizeStateDirEnv(env);
  migrateLegacyDefaultStateDir(env);
  isNixMode = resolveIsNixMode(env);
  STATE_DIR = resolveStateDir(env);
  CONFIG_PATH = resolveConfigPathCandidate(env);
  return { configPath: CONFIG_PATH, stateDir: STATE_DIR };
}

/**
 * Rename a pre-rebrand `~/.openclaw` state directory onto `~/.quiet-core-bot` on first
 * startup after an upgrade.
 *
 * Only the default (home-relative) location is migrated, and an existing current state
 * directory always wins, so an explicit `QUIET_CORE_STATE_DIR` or an already-upgraded
 * install is never moved and no data is overwritten.
 */
function migrateLegacyDefaultStateDir(env: NodeJS.ProcessEnv): void {
  if (env.QUIET_CORE_STATE_DIR?.trim()) {
    return;
  }
  const homedir = () => resolveRequiredHomeDir(env, os.homedir);
  renameLegacyStateDir({
    currentDir: newStateDir(homedir),
    legacyDir: path.join(homedir(), LEGACY_STATE_DIR_NAME),
  });
}

/**
 * Resolve default config path candidates across default locations.
 * Order: explicit config path → state-dir-derived path → new default.
 */
export function resolveDefaultConfigCandidates(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string[] {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const explicit = env.QUIET_CORE_CONFIG_PATH?.trim();
  if (explicit) {
    return [resolveUserPath(explicit, env, effectiveHomedir)];
  }

  const candidates: string[] = [];
  const stateDirOverride = env.QUIET_CORE_STATE_DIR?.trim();
  if (stateDirOverride) {
    candidates.push(
      path.join(resolveUserPath(stateDirOverride, env, effectiveHomedir), CONFIG_FILENAME),
    );
  }
  candidates.push(path.join(newStateDir(effectiveHomedir), CONFIG_FILENAME));
  return candidates;
}

export const DEFAULT_GATEWAY_PORT = 18789;

/**
 * Gateway lock directory (ephemeral).
 * Default: os.tmpdir()/quiet-core-bot-<uid> (uid suffix when available).
 */
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `quiet-core-bot-${uid}` : "quiet-core-bot";
  return path.join(base, suffix);
}

const OAUTH_FILENAME = "oauth.json";

/**
 * OAuth credentials storage directory.
 *
 * Precedence:
 * - `QUIET_CORE_OAUTH_DIR` (explicit override)
 * - `$*_STATE_DIR/credentials` (canonical server/default)
 */
export function resolveOAuthDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  const override = env.QUIET_CORE_OAUTH_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, "credentials");
}

export function resolveOAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  return path.join(resolveOAuthDir(env, stateDir), OAUTH_FILENAME);
}

function parseGatewayPortEnvValue(raw: string | undefined): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d+$/.test(trimmed)) {
    return parseTcpPort(trimmed);
  }

  // Docker Compose publish strings can leak into host CLI env loading via repo `.env`,
  // for example `127.0.0.1:18789` or `[::1]:18789`. Accept only explicit host:port forms.
  const bracketedIpv6Match = trimmed.match(/^\[[^\]]+\]:(\d+)$/);
  if (bracketedIpv6Match?.[1]) {
    return parseTcpPort(bracketedIpv6Match[1]);
  }

  const firstColon = trimmed.indexOf(":");
  const lastColon = trimmed.lastIndexOf(":");
  if (firstColon <= 0 || firstColon !== lastColon) {
    return null;
  }
  const suffix = trimmed.slice(firstColon + 1);
  if (!/^\d+$/.test(suffix)) {
    return null;
  }
  return parseTcpPort(suffix);
}

export function resolveGatewayPort(
  cfg?: QuietCoreConfig,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const envRaw = env.QUIET_CORE_GATEWAY_PORT?.trim();
  const envPort = parseGatewayPortEnvValue(envRaw);
  if (envPort !== null) {
    return envPort;
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort)) {
    if (configPort > 0) {
      return configPort;
    }
  }
  return DEFAULT_GATEWAY_PORT;
}
