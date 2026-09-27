// Extension Package Boundary script supports OpenClaw repository automation.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { privateLocalOnlyPluginSdkEntrypoints } from "./plugin-sdk-entries.mjs";

export const EXTENSION_PACKAGE_BOUNDARY_INCLUDE = ["./*.ts", "./src/**/*.ts"] as const;
export const EXTENSION_PACKAGE_BOUNDARY_EXCLUDE = [
  "./**/*.test.ts",
  "./dist/**",
  "./node_modules/**",
  "./src/test-support/**",
  "./src/**/*test-helpers.ts",
  "./src/**/*test-harness.ts",
  "./src/**/*test-support.ts",
] as const;

const privateLocalOnlyPluginSdkPackageDtsPaths = Object.fromEntries(
  privateLocalOnlyPluginSdkEntrypoints.map((entrypoint) => [
    `quiet-core-bot/plugin-sdk/${entrypoint}`,
    [`../packages/plugin-sdk/dist/src/plugin-sdk/${entrypoint}.d.ts`],
  ]),
) as Record<string, readonly string[]>;

function buildPackageBoundaryDtsPaths(params: {
  packageName: string;
  packageDir: string;
}): Record<string, readonly string[]> {
  const packageJson = JSON.parse(
    readFileSync(join("packages", params.packageDir, "package.json"), "utf8"),
  ) as { exports?: Record<string, unknown> };
  return Object.fromEntries(
    Object.entries(packageJson.exports ?? {}).flatMap(([exportKey, value]) => {
      const subpath =
        exportKey === "." ? "" : exportKey.startsWith("./") ? exportKey.slice(2) : null;
      const importPath =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>).import
          : value;
      if (subpath === null || subpath.includes("..") || typeof importPath !== "string") {
        return [];
      }
      if (!importPath.startsWith("./dist/") || !importPath.endsWith(".mjs")) {
        return [];
      }
      const specifier = subpath ? `${params.packageName}/${subpath}` : params.packageName;
      return [
        [
          specifier,
          [`../dist/plugin-sdk/packages/${params.packageDir}/src/${subpath || "index"}.d.ts`],
        ],
      ];
    }),
  );
}

export const EXTENSION_PACKAGE_BOUNDARY_BASE_PATHS = {
  "quiet-core-bot/extension-api": ["../src/extensionAPI.ts"],
  "quiet-core-bot/plugin-sdk": ["../dist/plugin-sdk/index.d.ts"],
  "quiet-core-bot/plugin-sdk/*": ["../dist/plugin-sdk/*.d.ts"],
  ...privateLocalOnlyPluginSdkPackageDtsPaths,
  "quiet-core-bot/plugin-sdk/account-id": ["../dist/plugin-sdk/account-id.d.ts"],
  "quiet-core-bot/plugin-sdk/channel-entry-contract": ["../dist/plugin-sdk/channel-entry-contract.d.ts"],
  "quiet-core-bot/plugin-sdk/browser-maintenance": [
    "../packages/plugin-sdk/dist/extensions/browser/browser-maintenance.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/channel-secret-basic-runtime": [
    "../dist/plugin-sdk/channel-secret-basic-runtime.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/channel-secret-runtime": ["../dist/plugin-sdk/channel-secret-runtime.d.ts"],
  "quiet-core-bot/plugin-sdk/channel-secret-tts-runtime": [
    "../dist/plugin-sdk/channel-secret-tts-runtime.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/channel-streaming": ["../dist/plugin-sdk/channel-streaming.d.ts"],
  "quiet-core-bot/plugin-sdk/error-runtime": ["../dist/plugin-sdk/error-runtime.d.ts"],
  "quiet-core-bot/plugin-sdk/provider-catalog-live-runtime": [
    "../dist/plugin-sdk/provider-catalog-live-runtime.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/provider-catalog-shared": [
    "../dist/plugin-sdk/provider-catalog-shared.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/provider-entry": ["../dist/plugin-sdk/provider-entry.d.ts"],
  "quiet-core-bot/plugin-sdk/secret-ref-runtime": ["../dist/plugin-sdk/secret-ref-runtime.d.ts"],
  "quiet-core-bot/plugin-sdk/ssrf-runtime": ["../dist/plugin-sdk/ssrf-runtime.d.ts"],
  "@quiet-core/qa-channel/api.js": ["../dist/plugin-sdk/extensions/qa-channel/api.d.ts"],
  "@quiet-core/discord/api.js": ["../dist/plugin-sdk/extensions/discord/api.d.ts"],
  "@quiet-core/slack/api.js": ["../dist/plugin-sdk/extensions/slack/api.d.ts"],
  "@quiet-core/whatsapp/api.js": ["../dist/plugin-sdk/extensions/whatsapp/api.d.ts"],
  "@quiet-core/llm-core": ["../dist/plugin-sdk/packages/llm-core/src/index.d.ts"],
  "@quiet-core/llm-core/diagnostics": [
    "../dist/plugin-sdk/packages/llm-core/src/utils/diagnostics.d.ts",
  ],
  "@quiet-core/llm-core/event-stream": [
    "../dist/plugin-sdk/packages/llm-core/src/utils/event-stream.d.ts",
  ],
  "@quiet-core/llm-core/types": ["../dist/plugin-sdk/packages/llm-core/src/types.d.ts"],
  "@quiet-core/llm-core/validation": ["../dist/plugin-sdk/packages/llm-core/src/validation.d.ts"],
  "@quiet-core/llm-core/*": ["../dist/plugin-sdk/packages/llm-core/src/*.d.ts"],
  "@quiet-core/model-catalog-core": ["../dist/plugin-sdk/packages/model-catalog-core/src/index.d.ts"],
  "@quiet-core/model-catalog-core/configured-model-refs": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/configured-model-refs.d.ts",
  ],
  "@quiet-core/model-catalog-core/model-catalog-refs": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/model-catalog-refs.d.ts",
  ],
  "@quiet-core/model-catalog-core/model-catalog-normalize": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/model-catalog-normalize.d.ts",
  ],
  "@quiet-core/model-catalog-core/model-catalog-types": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/model-catalog-types.d.ts",
  ],
  "@quiet-core/model-catalog-core/provider-id": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/provider-id.d.ts",
  ],
  "@quiet-core/model-catalog-core/provider-model-id-normalization": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/provider-model-id-normalization.d.ts",
  ],
  "@quiet-core/model-catalog-core/provider-model-id-normalize": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/provider-model-id-normalize.d.ts",
  ],
  "@quiet-core/model-catalog-core/*": ["../dist/plugin-sdk/packages/model-catalog-core/src/*.d.ts"],
  "@quiet-core/markdown-core": ["../dist/plugin-sdk/packages/markdown-core/src/index.d.ts"],
  "@quiet-core/markdown-core/code-spans": [
    "../dist/plugin-sdk/packages/markdown-core/src/code-spans.d.ts",
  ],
  "@quiet-core/markdown-core/fences": ["../dist/plugin-sdk/packages/markdown-core/src/fences.d.ts"],
  "@quiet-core/markdown-core/frontmatter": [
    "../dist/plugin-sdk/packages/markdown-core/src/frontmatter.d.ts",
  ],
  "@quiet-core/markdown-core/ir": ["../dist/plugin-sdk/packages/markdown-core/src/ir.d.ts"],
  "@quiet-core/markdown-core/render": ["../dist/plugin-sdk/packages/markdown-core/src/render.d.ts"],
  "@quiet-core/markdown-core/render-aware-chunking": [
    "../dist/plugin-sdk/packages/markdown-core/src/render-aware-chunking.d.ts",
  ],
  "@quiet-core/markdown-core/tables": ["../dist/plugin-sdk/packages/markdown-core/src/tables.d.ts"],
  "@quiet-core/markdown-core/types": ["../dist/plugin-sdk/packages/markdown-core/src/types.d.ts"],
  "@quiet-core/markdown-core/*": ["../dist/plugin-sdk/packages/markdown-core/src/*.d.ts"],
  "@quiet-core/media-generation-core": [
    "../dist/plugin-sdk/packages/media-generation-core/src/index.d.ts",
  ],
  "@quiet-core/media-generation-core/capability-model-ref": [
    "../dist/plugin-sdk/packages/media-generation-core/src/capability-model-ref.d.ts",
  ],
  "@quiet-core/media-generation-core/catalog": [
    "../dist/plugin-sdk/packages/media-generation-core/src/catalog.d.ts",
  ],
  "@quiet-core/media-generation-core/model-ref": [
    "../dist/plugin-sdk/packages/media-generation-core/src/model-ref.d.ts",
  ],
  "@quiet-core/media-generation-core/normalization": [
    "../dist/plugin-sdk/packages/media-generation-core/src/normalization.d.ts",
  ],
  "@quiet-core/media-generation-core/*": [
    "../dist/plugin-sdk/packages/media-generation-core/src/*.d.ts",
  ],
  "@quiet-core/media-core": ["../dist/plugin-sdk/packages/media-core/src/index.d.ts"],
  "@quiet-core/media-core/base64": ["../dist/plugin-sdk/packages/media-core/src/base64.d.ts"],
  "@quiet-core/media-core/constants": ["../dist/plugin-sdk/packages/media-core/src/constants.d.ts"],
  "@quiet-core/media-core/content-length": [
    "../dist/plugin-sdk/packages/media-core/src/content-length.d.ts",
  ],
  "@quiet-core/media-core/file-name": ["../dist/plugin-sdk/packages/media-core/src/file-name.d.ts"],
  "@quiet-core/media-core/inbound-path-policy": [
    "../dist/plugin-sdk/packages/media-core/src/inbound-path-policy.d.ts",
  ],
  "@quiet-core/media-core/inline-image-data-url": [
    "../dist/plugin-sdk/packages/media-core/src/inline-image-data-url.d.ts",
  ],
  "@quiet-core/media-core/media-source-url": [
    "../dist/plugin-sdk/packages/media-core/src/media-source-url.d.ts",
  ],
  "@quiet-core/media-core/mime": ["../dist/plugin-sdk/packages/media-core/src/mime.d.ts"],
  "@quiet-core/media-core/read-byte-stream-with-limit": [
    "../dist/plugin-sdk/packages/media-core/src/read-byte-stream-with-limit.d.ts",
  ],
  "@quiet-core/media-core/read-response-with-limit": [
    "../dist/plugin-sdk/packages/media-core/src/read-response-with-limit.d.ts",
  ],
  "@quiet-core/media-core/*": ["../dist/plugin-sdk/packages/media-core/src/*.d.ts"],
  "@quiet-core/normalization-core/record-coerce": [
    "../dist/plugin-sdk/packages/normalization-core/src/record-coerce.d.ts",
  ],
  "@quiet-core/normalization-core/string-coerce": [
    "../dist/plugin-sdk/packages/normalization-core/src/string-coerce.d.ts",
  ],
  "@quiet-core/normalization-core/*": ["../dist/plugin-sdk/packages/normalization-core/src/*.d.ts"],
  ...buildPackageBoundaryDtsPaths({
    packageName: "@quiet-core/acp-core",
    packageDir: "acp-core",
  }),
  "@quiet-core/acp-core/*": ["../dist/plugin-sdk/packages/acp-core/src/*.d.ts"],
  "@quiet-core/terminal-core": ["../dist/plugin-sdk/packages/terminal-core/src/index.d.ts"],
  "@quiet-core/terminal-core/ansi": ["../dist/plugin-sdk/packages/terminal-core/src/ansi.d.ts"],
  "@quiet-core/terminal-core/decorative-emoji": [
    "../dist/plugin-sdk/packages/terminal-core/src/decorative-emoji.d.ts",
  ],
  "@quiet-core/terminal-core/health-style": [
    "../dist/plugin-sdk/packages/terminal-core/src/health-style.d.ts",
  ],
  "@quiet-core/terminal-core/links": ["../dist/plugin-sdk/packages/terminal-core/src/links.d.ts"],
  "@quiet-core/terminal-core/note": ["../dist/plugin-sdk/packages/terminal-core/src/note.d.ts"],
  "@quiet-core/terminal-core/osc-progress": [
    "../dist/plugin-sdk/packages/terminal-core/src/osc-progress.d.ts",
  ],
  "@quiet-core/terminal-core/palette": ["../dist/plugin-sdk/packages/terminal-core/src/palette.d.ts"],
  "@quiet-core/terminal-core/progress-line": [
    "../dist/plugin-sdk/packages/terminal-core/src/progress-line.d.ts",
  ],
  "@quiet-core/terminal-core/prompt-select-styled": [
    "../dist/plugin-sdk/packages/terminal-core/src/prompt-select-styled.d.ts",
  ],
  "@quiet-core/terminal-core/prompt-select-styled-params": [
    "../dist/plugin-sdk/packages/terminal-core/src/prompt-select-styled-params.d.ts",
  ],
  "@quiet-core/terminal-core/prompt-style": [
    "../dist/plugin-sdk/packages/terminal-core/src/prompt-style.d.ts",
  ],
  "@quiet-core/terminal-core/restore": ["../dist/plugin-sdk/packages/terminal-core/src/restore.d.ts"],
  "@quiet-core/terminal-core/safe-text": [
    "../dist/plugin-sdk/packages/terminal-core/src/safe-text.d.ts",
  ],
  "@quiet-core/terminal-core/stream-writer": [
    "../dist/plugin-sdk/packages/terminal-core/src/stream-writer.d.ts",
  ],
  "@quiet-core/terminal-core/table": ["../dist/plugin-sdk/packages/terminal-core/src/table.d.ts"],
  "@quiet-core/terminal-core/terminal-link": [
    "../dist/plugin-sdk/packages/terminal-core/src/terminal-link.d.ts",
  ],
  "@quiet-core/terminal-core/theme": ["../dist/plugin-sdk/packages/terminal-core/src/theme.d.ts"],
  "@quiet-core/terminal-core/*": ["../dist/plugin-sdk/packages/terminal-core/src/*.d.ts"],
  "@quiet-core/*.js": ["../packages/plugin-sdk/dist/extensions/*.d.ts", "../extensions/*"],
  "@quiet-core/*": ["../packages/plugin-sdk/dist/extensions/*", "../extensions/*"],
  "quiet-core-bot/plugin-sdk/qa-channel": ["../dist/plugin-sdk/src/plugin-sdk/qa-channel.d.ts"],
  "quiet-core-bot/plugin-sdk/qa-channel-protocol": [
    "../dist/plugin-sdk/src/plugin-sdk/qa-channel-protocol.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/qa-runtime": ["../dist/plugin-sdk/src/plugin-sdk/qa-runtime.d.ts"],
  "@quiet-core/plugin-sdk/*": ["../dist/plugin-sdk/*.d.ts"],
} as const;

function prefixExtensionPackageBoundaryPaths(
  paths: Record<string, readonly string[]>,
  prefix: string,
): Record<string, readonly string[]> {
  return Object.fromEntries(
    Object.entries(paths).map(([key, values]) => [
      key,
      values.map((value) => posix.join(prefix, value)),
    ]),
  );
}

export const EXTENSION_PACKAGE_BOUNDARY_XAI_PATHS = {
  ...prefixExtensionPackageBoundaryPaths(
    (({
      "quiet-core-bot/plugin-sdk/channel-secret-basic-runtime": _omitBasic,
      "quiet-core-bot/plugin-sdk/channel-secret-tts-runtime": _omitTts,
      "@quiet-core/discord/api.js": _omitDiscord,
      "@quiet-core/slack/api.js": _omitSlack,
      "@quiet-core/whatsapp/api.js": _omitWhatsApp,
      ...rest
    }) => rest)(EXTENSION_PACKAGE_BOUNDARY_BASE_PATHS),
    "../",
  ),
  "quiet-core-bot/plugin-sdk/channel-entry-contract": [
    "../../dist/plugin-sdk/channel-entry-contract.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/browser-maintenance": [
    "../../dist/plugin-sdk/src/plugin-sdk/browser-maintenance.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/cli-runtime": ["../../dist/plugin-sdk/cli-runtime.d.ts"],
  "quiet-core-bot/plugin-sdk/provider-catalog-live-runtime": [
    "../../dist/plugin-sdk/provider-catalog-live-runtime.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/provider-catalog-shared": [
    "../../dist/plugin-sdk/provider-catalog-shared.d.ts",
  ],
  "quiet-core-bot/plugin-sdk/provider-env-vars": ["../../dist/plugin-sdk/provider-env-vars.d.ts"],
  "quiet-core-bot/plugin-sdk/provider-entry": ["../../dist/plugin-sdk/provider-entry.d.ts"],
  "quiet-core-bot/plugin-sdk/provider-web-search-contract": [
    "../../dist/plugin-sdk/provider-web-search-contract.d.ts",
  ],
  "@quiet-core/qa-channel/api.js": ["../../dist/plugin-sdk/extensions/qa-channel/api.d.ts"],
  "@quiet-core/*.js": ["../../packages/plugin-sdk/dist/extensions/*.d.ts", "../*"],
  "@quiet-core/*": ["../*"],
  "@quiet-core/plugin-sdk/*": ["../../dist/plugin-sdk/*.d.ts"],
  "@quiet-core/anthropic-vertex/api.js": ["./.boundary-stubs/anthropic-vertex-api.d.ts"],
  "@quiet-core/ollama/api.js": ["./.boundary-stubs/ollama-api.d.ts"],
  "@quiet-core/ollama/runtime-api.js": ["./.boundary-stubs/ollama-runtime-api.d.ts"],
  "@quiet-core/speech-core/runtime-api.js": ["./.boundary-stubs/speech-core-runtime-api.d.ts"],
} as const;

type ExtensionPackageBoundaryTsConfigJson = {
  extends?: unknown;
  compilerOptions?: {
    rootDir?: unknown;
    paths?: unknown;
  };
  include?: unknown;
  exclude?: unknown;
};

type ExtensionPackageBoundaryPackageJson = {
  devDependencies?: Record<string, string>;
};

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function collectBundledExtensionIds(rootDir = resolve(".")): string[] {
  return readdirSync(join(rootDir, "extensions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
}

function resolveExtensionTsconfigPath(extensionId: string, rootDir = resolve(".")): string {
  return join(rootDir, "extensions", extensionId, "tsconfig.json");
}

function resolveExtensionPackageJsonPath(extensionId: string, rootDir = resolve(".")): string {
  return join(rootDir, "extensions", extensionId, "package.json");
}

export function readExtensionPackageBoundaryTsconfig(
  extensionId: string,
  rootDir = resolve("."),
): ExtensionPackageBoundaryTsConfigJson {
  return readJsonFile(
    resolveExtensionTsconfigPath(extensionId, rootDir),
  ) as ExtensionPackageBoundaryTsConfigJson;
}

export function readExtensionPackageBoundaryPackageJson(
  extensionId: string,
  rootDir = resolve("."),
): ExtensionPackageBoundaryPackageJson {
  return readJsonFile(
    resolveExtensionPackageJsonPath(extensionId, rootDir),
  ) as ExtensionPackageBoundaryPackageJson;
}

export function isOptInExtensionPackageBoundaryTsconfig(
  tsconfig: ExtensionPackageBoundaryTsConfigJson,
): boolean {
  return tsconfig.extends === "../tsconfig.package-boundary.base.json";
}

export function collectExtensionsWithTsconfig(rootDir = resolve(".")): string[] {
  return collectBundledExtensionIds(rootDir).filter((extensionId) =>
    existsSync(resolveExtensionTsconfigPath(extensionId, rootDir)),
  );
}

export function collectOptInExtensionPackageBoundaries(rootDir = resolve(".")): string[] {
  return collectExtensionsWithTsconfig(rootDir).filter((extensionId) =>
    isOptInExtensionPackageBoundaryTsconfig(
      readExtensionPackageBoundaryTsconfig(extensionId, rootDir),
    ),
  );
}
