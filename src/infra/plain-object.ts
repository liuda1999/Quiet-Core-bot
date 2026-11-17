/**
 * Strict plain-object guard (excludes arrays and host objects).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Loose record guard: any non-null object that is not an array.
 *
 * Lives here rather than `src/utils.ts` so config type modules can depend on a
 * leaf without pulling in the state-directory resolver.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
