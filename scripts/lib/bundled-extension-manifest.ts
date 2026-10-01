// Bundled Extension Manifest script supports QuietCore repository automation.
import {
  MIN_HOST_VERSION_FORMAT,
  parseMinHostVersionRequirement,
} from "../../src/plugins/min-host-version.ts";
import { isRecord } from "../../src/utils.js";

export type ExtensionPackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  "quiet-core-bot"?: {
    install?: unknown;
    releaseChecks?: unknown;
  };
};

export type BundledExtension = { id: string; packageJson: ExtensionPackageJson };

export function collectBundledExtensionManifestErrors(extensions: BundledExtension[]): string[] {
  const errors: string[] = [];

  for (const extension of extensions) {
    const install = extension.packageJson["quiet-core-bot"]?.install;
    if (install !== undefined && !isRecord(install)) {
      errors.push(
        `bundled extension '${extension.id}' manifest invalid | quiet-core-bot.install must be an object`,
      );
      continue;
    }
    const hasNpmSpec = isRecord(install) && "npmSpec" in install;
    if (
      hasNpmSpec &&
      (!install.npmSpec || typeof install.npmSpec !== "string" || !install.npmSpec.trim())
    ) {
      errors.push(
        `bundled extension '${extension.id}' manifest invalid | quiet-core-bot.install.npmSpec must be a non-empty string`,
      );
    }
    const minHostVersionError =
      install?.minHostVersion === undefined ||
      parseMinHostVersionRequirement(install.minHostVersion)
        ? null
        : MIN_HOST_VERSION_FORMAT;
    if (minHostVersionError) {
      errors.push(`bundled extension '${extension.id}' manifest invalid | ${minHostVersionError}`);
    }
  }

  return errors;
}
