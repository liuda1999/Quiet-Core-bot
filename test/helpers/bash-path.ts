// Resolves a usable POSIX shell for tests that shell out to repository scripts.
import fs from "node:fs";
import path from "node:path";

const WINDOWS_GIT_BASH_CANDIDATES = [
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Git", "usr", "bin", "bash.exe"),
  process.env["ProgramFiles(x86)"] &&
    path.join(process.env["ProgramFiles(x86)"], "Git", "usr", "bin", "bash.exe"),
  "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
].filter((candidate): candidate is string => Boolean(candidate));

function firstBashOnPath(pathValue: string | undefined = process.env.PATH): string | undefined {
  const segments = (pathValue ?? "").split(path.delimiter).filter((segment) => segment);
  return segments.map((segment) => path.join(segment, "bash.exe")).find((c) => fs.existsSync(c));
}

function gitBashOnDisk(): string | undefined {
  return WINDOWS_GIT_BASH_CANDIDATES.find((candidate) => fs.existsSync(candidate));
}

/**
 * Returns the bash executable the shell-script tests should invoke.
 *
 * On Windows the first `bash` on PATH is sometimes the System32 WSL launcher,
 * which fails immediately when no WSL distribution is installed. In that case
 * prefer the Git for Windows bash so the tests exercise the real scripts.
 */
export function resolveBashPath(): string {
  if (process.platform !== "win32") {
    return "/bin/bash";
  }
  const first = firstBashOnPath();
  if (first && path.basename(path.dirname(first)).toLowerCase() !== "system32") {
    return first;
  }
  return gitBashOnDisk() ?? "bash";
}

/**
 * Returns an env whose PATH resolves nested `bash` invocations to a working
 * shell. Repository wrappers such as `scripts/android-release.sh` re-exec
 * `bash`, so the child process needs a working bash ahead of the System32 WSL
 * launcher on Windows.
 */
export function resolveBashEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (process.platform !== "win32") {
    return env;
  }
  const gitBash = gitBashOnDisk();
  if (!gitBash) {
    return env;
  }
  const gitBashDir = path.dirname(gitBash);
  // Windows env objects can carry both `Path` and `PATH`; collapse them so the
  // child process (and nested `bash` lookups) sees a single ordered value.
  const pathKeys = Object.keys(env).filter((key) => key.toLowerCase() === "path");
  const pathValue =
    pathKeys.map((key) => env[key] ?? "").sort((left, right) => right.length - left.length)[0] ??
    "";
  const segments = pathValue
    .split(path.delimiter)
    .filter((segment) => segment && segment !== gitBashDir);
  const next: NodeJS.ProcessEnv = { ...env };
  for (const key of pathKeys) {
    delete next[key];
  }
  next.PATH = [gitBashDir, ...segments].join(path.delimiter);
  return next;
}
