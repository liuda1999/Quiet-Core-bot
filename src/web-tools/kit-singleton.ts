/**
 * Process-level singleton for the vendored web kit.
 *
 * LOCAL CODE (not vendored). `createWebKit` may own a browser process, so it
 * must be created once per process and disposed on shutdown. A `globalThis`
 * slot keeps tsx hot reloads and repeated module evaluation from starting a
 * second browser pool.
 */
import { createWebKit, type WebKit, type WebKitOptions } from "./index.js";

const SLOT = Symbol.for("quiet-core.web-tools.kit.v1");

interface Slot {
  readonly fingerprint: string;
  readonly kit: WebKit;
}

type Store = { [SLOT]?: Slot };

const store = globalThis as unknown as Store;

/** Return the kit for this option set, rebuilding it when the options changed. */
export function getWebKit(options: WebKitOptions, fingerprint: string): WebKit {
  const existing = store[SLOT];
  if (existing !== undefined && existing.fingerprint === fingerprint) {
    return existing.kit;
  }

  const kit = createWebKit(options);
  store[SLOT] = { fingerprint, kit };
  if (existing !== undefined) {
    void existing.kit.dispose().catch(() => undefined);
  }
  return kit;
}

/** Dispose the current kit. Safe to call more than once. */
export async function disposeWebKit(): Promise<void> {
  const existing = store[SLOT];
  if (existing === undefined) {
    return;
  }
  delete store[SLOT];
  await existing.kit.dispose().catch(() => undefined);
}

process.once("beforeExit", () => {
  void disposeWebKit();
});
