// Qa Lab plugin module implements cli behavior.
import {
  runMantisDesktopBrowserSmoke,
  type MantisDesktopBrowserSmokeOptions,
} from "./desktop-browser-smoke.runtime.js";
import {
  runMantisVisualDriver,
  runMantisVisualTask,
  type MantisVisualDriverOptions,
  type MantisVisualTaskOptions,
} from "./visual-task.runtime.js";

export async function runMantisDesktopBrowserSmokeCommand(opts: MantisDesktopBrowserSmokeOptions) {
  const result = await runMantisDesktopBrowserSmoke(opts);
  process.stdout.write(`Mantis desktop browser report: ${result.reportPath}\n`);
  process.stdout.write(`Mantis desktop browser summary: ${result.summaryPath}\n`);
  if (result.screenshotPath) {
    process.stdout.write(`Mantis desktop browser screenshot: ${result.screenshotPath}\n`);
  }
  if (result.videoPath) {
    process.stdout.write(`Mantis desktop browser video: ${result.videoPath}\n`);
  }
  if (result.status === "fail") {
    process.exitCode = 1;
  }
}

export async function runMantisVisualDriverCommand(opts: MantisVisualDriverOptions) {
  const result = await runMantisVisualDriver(opts);
  process.stdout.write(`Mantis visual driver result: ${result.status}\n`);
  process.stdout.write(`Mantis visual driver screenshot: ${result.screenshotPath}\n`);
  if (result.status === "fail") {
    process.exitCode = 1;
  }
}

export async function runMantisVisualTaskCommand(opts: MantisVisualTaskOptions) {
  const result = await runMantisVisualTask(opts);
  process.stdout.write(`Mantis visual task report: ${result.reportPath}\n`);
  process.stdout.write(`Mantis visual task summary: ${result.summaryPath}\n`);
  if (result.screenshotPath) {
    process.stdout.write(`Mantis visual task screenshot: ${result.screenshotPath}\n`);
  }
  if (result.videoPath) {
    process.stdout.write(`Mantis visual task video: ${result.videoPath}\n`);
  }
  if (result.status === "fail") {
    process.exitCode = 1;
  }
}
