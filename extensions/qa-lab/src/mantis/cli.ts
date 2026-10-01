// Qa Lab plugin module implements cli behavior.
import type { Command } from "commander";
import { createLazyCliRuntimeLoader } from "../live-transports/shared/live-transport-cli.js";
import type { MantisDesktopBrowserSmokeOptions } from "./desktop-browser-smoke.runtime.js";
import type {
  MantisVisualDriverOptions,
  MantisVisualTaskOptions,
  MantisVisualTaskVisionMode,
} from "./visual-task.runtime.js";

type MantisCliRuntime = typeof import("./cli.runtime.js");

const loadMantisCliRuntime = createLazyCliRuntimeLoader<MantisCliRuntime>(
  () => import("./cli.runtime.js"),
);

async function runDesktopBrowserSmoke(opts: MantisDesktopBrowserSmokeOptions) {
  const runtime = await loadMantisCliRuntime();
  await runtime.runMantisDesktopBrowserSmokeCommand(opts);
}

async function runVisualDriver(opts: MantisVisualDriverOptions) {
  const runtime = await loadMantisCliRuntime();
  await runtime.runMantisVisualDriverCommand(opts);
}

async function runVisualTask(opts: MantisVisualTaskOptions) {
  const runtime = await loadMantisCliRuntime();
  await runtime.runMantisVisualTaskCommand(opts);
}

type MantisDesktopBrowserSmokeCommanderOptions = {
  browserProfileArchiveEnv?: string;
  browserProfileDir?: string;
  browserUrl?: string;
  class?: string;
  crabboxBin?: string;
  htmlFile?: string;
  idleTimeout?: string;
  keepLease?: boolean;
  leaseId?: string;
  machineClass?: string;
  outputDir?: string;
  provider?: string;
  repoRoot?: string;
  ttl?: string;
  videoDuration?: string;
};

type MantisVisualTaskCommanderOptions = {
  browserUrl?: string;
  class?: string;
  crabboxBin?: string;
  duration?: string;
  expectText?: string;
  idleTimeout?: string;
  keepLease?: boolean;
  leaseId?: string;
  machineClass?: string;
  outputDir?: string;
  provider?: string;
  repoRoot?: string;
  settleMs?: string;
  ttl?: string;
  visionMode?: MantisVisualTaskVisionMode;
  visionModel?: string;
  visionPrompt?: string;
  visionTimeoutMs?: string;
};

type MantisVisualDriverCommanderOptions = {
  browserUrl?: string;
  crabboxBin?: string;
  expectText?: string;
  leaseId?: string;
  outputDir?: string;
  provider?: string;
  repoRoot?: string;
  settleMs?: string;
  visionMode?: MantisVisualTaskVisionMode;
  visionModel?: string;
  visionPrompt?: string;
  visionTimeoutMs?: string;
};

function parseOptionalInteger(value: string | undefined, label: string) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== value || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

export function registerMantisCli(qa: Command) {
  const mantis = qa
    .command("mantis")
    .description("Run Mantis desktop and visual verification flows");

  mantis
    .command("desktop-browser-smoke")
    .description(
      "Lease or reuse a Crabbox desktop, open a visible browser, and capture VNC desktop screenshot/video artifacts",
    )
    .option("--repo-root <path>", "Repository root to target when running from a neutral cwd")
    .option("--output-dir <path>", "Mantis desktop browser artifact directory")
    .option("--browser-url <url>", "URL to open in the visible browser")
    .option(
      "--browser-profile-archive-env <name>",
      "Env var containing a base64 .tgz Chrome profile archive to restore before launch",
    )
    .option(
      "--browser-profile-dir <remote-path>",
      "Remote Chrome user-data-dir path to reuse for browser login state",
    )
    .option("--html-file <path>", "Repo-local HTML file to render in the visible browser")
    .option("--crabbox-bin <path>", "Crabbox binary path")
    .option("--provider <provider>", "Crabbox provider")
    .option("--machine-class <class>", "Crabbox machine class")
    .option("--class <class>", "Alias for --machine-class")
    .option("--lease-id <id>", "Reuse an existing Crabbox lease")
    .option("--idle-timeout <duration>", "Crabbox idle timeout")
    .option("--ttl <duration>", "Crabbox maximum lease lifetime")
    .option("--video-duration <seconds>", "Visible desktop recording duration in seconds")
    .option("--keep-lease", "Keep a lease created by this run after a passing smoke")
    .action(async (opts: MantisDesktopBrowserSmokeCommanderOptions) => {
      await runDesktopBrowserSmoke({
        browserProfileArchiveEnv: opts.browserProfileArchiveEnv,
        browserProfileDir: opts.browserProfileDir,
        browserUrl: opts.browserUrl,
        crabboxBin: opts.crabboxBin,
        htmlFile: opts.htmlFile,
        idleTimeout: opts.idleTimeout,
        keepLease: opts.keepLease,
        leaseId: opts.leaseId,
        machineClass: opts.machineClass ?? opts.class,
        outputDir: opts.outputDir,
        provider: opts.provider,
        repoRoot: opts.repoRoot,
        ttl: opts.ttl,
        videoDurationSeconds: parseOptionalInteger(opts.videoDuration, "--video-duration"),
      });
    });

  mantis
    .command("visual-task")
    .description(
      "Lease or reuse a Crabbox desktop, drive visible browser UI, record MP4, screenshot it, and optionally run image-understanding assertions",
    )
    .option("--repo-root <path>", "Repository root to target when running from a neutral cwd")
    .option("--output-dir <path>", "Mantis visual-task artifact directory")
    .option("--crabbox-bin <path>", "Crabbox binary path")
    .option("--provider <provider>", "Crabbox provider")
    .option("--machine-class <class>", "Crabbox machine class")
    .option("--class <class>", "Alias for --machine-class")
    .option("--lease-id <id>", "Reuse an existing Crabbox lease")
    .option("--idle-timeout <duration>", "Crabbox idle timeout")
    .option("--ttl <duration>", "Crabbox maximum lease lifetime")
    .option("--keep-lease", "Keep a lease created by this run after a passing task")
    .option("--browser-url <url>", "URL to open in the visible browser")
    .option("--duration <duration>", "Desktop recording duration")
    .option("--settle-ms <ms>", "Milliseconds to wait after launch before screenshot")
    .option("--vision-mode <mode>", "Vision mode: image-describe or metadata")
    .option("--vision-prompt <text>", "Prompt for image understanding")
    .option("--vision-model <provider/model>", "Image-capable provider/model ref")
    .option("--vision-timeout-ms <ms>", "Image understanding timeout in milliseconds")
    .option("--expect-text <text>", "Case-insensitive text expected in the vision output")
    .action(async (opts: MantisVisualTaskCommanderOptions) => {
      await runVisualTask({
        browserUrl: opts.browserUrl,
        crabboxBin: opts.crabboxBin,
        duration: opts.duration,
        expectText: opts.expectText,
        idleTimeout: opts.idleTimeout,
        keepLease: opts.keepLease,
        leaseId: opts.leaseId,
        machineClass: opts.machineClass ?? opts.class,
        outputDir: opts.outputDir,
        provider: opts.provider,
        repoRoot: opts.repoRoot,
        settleMs: parseOptionalInteger(opts.settleMs, "--settle-ms"),
        ttl: opts.ttl,
        visionMode: opts.visionMode,
        visionModel: opts.visionModel,
        visionPrompt: opts.visionPrompt,
        visionTimeoutMs: parseOptionalInteger(opts.visionTimeoutMs, "--vision-timeout-ms"),
      });
    });

  mantis
    .command("visual-driver")
    .description(
      "Driver half for Mantis visual-task; launched by Crabbox record --while, then opens browser, screenshots, and runs vision",
    )
    .option("--repo-root <path>", "Repository root to target when running from a neutral cwd")
    .option("--output-dir <path>", "Mantis visual-task artifact directory")
    .option("--crabbox-bin <path>", "Crabbox binary path")
    .option("--provider <provider>", "Crabbox provider")
    .option("--lease-id <id>", "Crabbox lease id")
    .option("--browser-url <url>", "URL to open in the visible browser")
    .option("--settle-ms <ms>", "Milliseconds to wait after launch before screenshot")
    .option("--vision-mode <mode>", "Vision mode: image-describe or metadata")
    .option("--vision-prompt <text>", "Prompt for image understanding")
    .option("--vision-model <provider/model>", "Image-capable provider/model ref")
    .option("--vision-timeout-ms <ms>", "Image understanding timeout in milliseconds")
    .option("--expect-text <text>", "Case-insensitive text expected in the vision output")
    .action(async (opts: MantisVisualDriverCommanderOptions) => {
      await runVisualDriver({
        browserUrl: opts.browserUrl,
        crabboxBin: opts.crabboxBin,
        expectText: opts.expectText,
        leaseId: opts.leaseId,
        outputDir: opts.outputDir,
        provider: opts.provider,
        repoRoot: opts.repoRoot,
        settleMs: parseOptionalInteger(opts.settleMs, "--settle-ms"),
        visionMode: opts.visionMode,
        visionModel: opts.visionModel,
        visionPrompt: opts.visionPrompt,
        visionTimeoutMs: parseOptionalInteger(opts.visionTimeoutMs, "--vision-timeout-ms"),
      });
    });
}
