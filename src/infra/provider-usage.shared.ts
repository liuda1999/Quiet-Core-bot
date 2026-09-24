// Shared provider usage timeout helpers.
import { resolveTimerTimeoutMs } from "../shared/number-coercion.js";

/** Default timeout for provider usage collection. */
export const DEFAULT_TIMEOUT_MS = 5000;

export const ignoredErrors = new Set([
  "No credentials",
  "No token",
  "No API key",
  "Not logged in",
  "No auth",
]);

export const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

/** Resolves a promise with a fallback when usage collection exceeds the timeout. */
export const withTimeout = async <T>(work: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutMs = resolveTimerTimeoutMs(ms, 1);
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};
