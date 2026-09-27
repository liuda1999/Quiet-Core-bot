// Website Installer Sync Workflow tests cover website installer sync workflow script behavior.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const { detectInstallSmokeScope } = (await import("../../scripts/ci-changed-scope.mjs")) as {
  detectInstallSmokeScope: (paths: string[]) => {
    runFastInstallSmoke: boolean;
    runFullInstallSmoke: boolean;
  };
};

const WORKFLOW_PATH = ".github/workflows/website-installer-sync.yml";

describe("website installer sync workflow", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");

  it("treats all website installer scripts as OpenClaw-owned inputs", () => {
    for (const path of ["scripts/install.sh", "scripts/install-cli.sh", "scripts/install.ps1"]) {
      expect(workflow).toContain(path);
      expect(detectInstallSmokeScope([path]).runFullInstallSmoke).toBe(true);
    }
  });

  it("verifies installers on Linux Docker plus native macOS and Windows runners", () => {
    expect(workflow).toContain("linux-docker:");
    expect(workflow.match(/timeout --kill-after=30s 20m docker run --rm/g)?.length).toBe(2);
    expect(workflow).not.toContain("timeout 20m docker run --rm");
    expect(workflow).not.toMatch(/(^|\n)\s+docker run --rm/u);
    expect(workflow).toContain("bash /tmp/install.sh --version latest && quiet-core-bot --version");
    expect(workflow).not.toContain("bash /tmp/install.sh --no-prompt --no-onboard");
    expect(workflow).toContain("bash /tmp/install-cli.sh --prefix /tmp/quiet-core-bot");
    expect(workflow).toContain("macos-installer:");
    expect(workflow).toContain("runs-on: macos-15");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain('QUIET_CORE_NO_ONBOARD: "1"');
    expect(workflow).toContain('QUIET_CORE_NO_PROMPT: "1"');
    expect(workflow).toContain("bash scripts/install.sh --no-onboard --no-prompt --version latest");
    expect(workflow).toContain("quiet-core-bot --version");
    expect(workflow).toContain("windows-installer:");
    expect(workflow).toContain("runs-on: windows-latest");
    expect(workflow).toContain(".\\scripts\\install.ps1 -DryRun");
    expect(workflow).not.toContain("install.cmd dry run");
    expect(workflow).not.toContain(".\\scripts\\install.cmd");
  });

  it("syncs verified scripts to openclaw.ai only after all installer checks pass", () => {
    expect(workflow).toContain("needs: [static, linux-docker, macos-installer, windows-installer]");
    expect(workflow).toContain("repository: quiet-core-bot/openclaw.ai");
    expect(workflow).toContain("QUIET_CORE_GH_TOKEN: ${{ secrets.QUIET_CORE_GH_TOKEN }}");
    expect(workflow).toContain("QUIET_CORE_GH_TOKEN is not configured");
    expect(workflow).toContain("token: ${{ env.QUIET_CORE_GH_TOKEN }}");
    expect(workflow).toContain("cp quiet-core-bot/scripts/install.sh openclaw.ai/public/install.sh");
    expect(workflow).toContain(
      "cp quiet-core-bot/scripts/install-cli.sh openclaw.ai/public/install-cli.sh",
    );
    expect(workflow).toContain("cp quiet-core-bot/scripts/install.ps1 openclaw.ai/public/install.ps1");
    expect(workflow).toContain("rm -f openclaw.ai/public/install.cmd");
    expect(workflow).toContain("bun run build");
    expect(workflow).toContain("git push origin HEAD:main");
  });
});
