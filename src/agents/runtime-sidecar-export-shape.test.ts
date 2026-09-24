/**
 * A7: `export *` runtime sidecar shims never forward a `default` binding.
 *
 * `scripts/runtime-postbuild.mjs` emits a stable-filename shim
 * (`export * from "./<hashed>.js";`) for every root-level `*.runtime-*` / `*.contract-*` chunk and
 * rewrites the lazy `import()`s onto it. A sidecar whose consumer reads a `default` export
 * therefore resolves `undefined` at runtime while every type-check and unit test passes — exactly
 * the I01 `TypeError: reconcile is not a function`.
 *
 * These tests pin the shape so the class cannot come back silently.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as compactionRuntimeSidecar from "./embedded-agent-subscribe.handlers.compaction.runtime.js";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

const SIDECAR_SOURCE_SUFFIXES = [".runtime.ts", ".contract.ts"];

function listSidecarSources(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (SIDECAR_SOURCE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
        found.push(fullPath);
      }
    }
  };
  walk(root);
  return found;
}

describe("runtime sidecar export shape (A7)", () => {
  it("keeps the lazily imported compaction sidecar on a named export", () => {
    expect(typeof compactionRuntimeSidecar.reconcileSessionStoreCompactionCountAfterSuccess).toBe(
      "function",
    );
    // The shim drops `default`; a default export here would be unreachable through the loader.
    expect(Object.hasOwn(compactionRuntimeSidecar, "default")).toBe(false);
  });

  it("declares no `default` export in any *.runtime.ts / *.contract.ts sidecar", () => {
    const offenders: string[] = [];
    for (const sourceRoot of ["src", "packages", "extensions"]) {
      for (const filePath of listSidecarSources(path.join(REPO_ROOT, sourceRoot))) {
        const contents = readFileSync(filePath, "utf8");
        if (/\bexport\s+default\b/u.test(contents) || /\bas\s+default\b/u.test(contents)) {
          offenders.push(path.relative(REPO_ROOT, filePath));
        }
      }
    }
    // If this fails, replace the default export with a named one (or add an explicit runtime
    // guard), because the bundled stable-filename shim resolves through `export *`.
    expect(offenders).toEqual([]);
  });
});
