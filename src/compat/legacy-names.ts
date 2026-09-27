// Product/package naming constants that bridge current Quiet Core bot manifests with
// legacy Clawdbot keys still seen in older configs and packages.
export const PROJECT_NAME = "quiet-core-bot" as const;

const LEGACY_PROJECT_NAMES = ["clawdbot"] as const;

/**
 * package.json block key carrying plugin/skill metadata for this project.
 */
export const MANIFEST_KEY = "quiet-core-bot" as const;

/** Manifest keys accepted only for legacy compatibility. */
export const LEGACY_MANIFEST_KEYS = LEGACY_PROJECT_NAMES;

export const MACOS_APP_SOURCES_DIR = "apps/macos/Sources/OpenClaw" as const;
