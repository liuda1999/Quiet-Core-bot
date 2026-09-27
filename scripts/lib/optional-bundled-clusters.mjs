// Optional bundled plugin cluster policy used by build and package scripts.
const optionalBundledClusters = [
  "acpx",
  "diagnostics-otel",
  "diffs",
  "memory-lancedb",
  "nostr",
  "raft",
  "tlon",
  "ui",
];

/** Bundled plugin clusters that may be excluded from size-sensitive build lanes. */
export const optionalBundledClusterSet = new Set(optionalBundledClusters);

const OPTIONAL_BUNDLED_BUILD_ENV = "QUIET_CORE_INCLUDE_OPTIONAL_BUNDLED";

function isOptionalBundledCluster(cluster) {
  return optionalBundledClusterSet.has(cluster);
}

function shouldIncludeOptionalBundledClusters(env = process.env) {
  // Release artifacts should preserve the last shipped upgrade surface by
  // default. Specific size-sensitive lanes can still opt out explicitly.
  return env[OPTIONAL_BUNDLED_BUILD_ENV] !== "0";
}

function hasReleasedBundledInstall(packageJson) {
  return (
    typeof packageJson?.["quiet-core-bot"]?.install?.npmSpec === "string" &&
    packageJson["quiet-core-bot"].install.npmSpec.trim().length > 0
  );
}

/** Decide whether a bundled plugin cluster should be included in the current build. */
export function shouldBuildBundledCluster(cluster, env = process.env, options = {}) {
  if (hasReleasedBundledInstall(options.packageJson)) {
    return true;
  }
  return shouldIncludeOptionalBundledClusters(env) || !isOptionalBundledCluster(cluster);
}
