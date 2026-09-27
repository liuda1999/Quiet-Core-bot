// Qa Lab tests cover docker harness plugin behavior.
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import { buildQaDockerHarnessImage, writeQaDockerHarnessFiles } from "./docker-harness.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function parseComposeServices(compose: string) {
  const parsed = YAML.parse(compose) as {
    services?: Record<
      string,
      {
        build?: { context?: string };
        environment?: Record<string, string>;
        volumes?: string[];
      }
    >;
  };
  return parsed.services ?? {};
}

describe("qa docker harness", () => {
  it("writes compose, env, config, and workspace scaffold files", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "qa-docker-test-"));
    cleanups.push(async () => {
      await rm(outputDir, { recursive: true, force: true });
    });

    const result = await writeQaDockerHarnessFiles({
      outputDir,
      gatewayPort: 18889,
      qaLabPort: 43124,
      gatewayToken: "qa-token",
      providerBaseUrl: "http://host.docker.internal:45123/v1",
      repoRoot: "/repo/quiet-core-bot",
      usePrebuiltImage: true,
      bindUiDist: true,
    });

    for (const expectedFile of [
      path.join(outputDir, ".env.example"),
      path.join(outputDir, "README.md"),
      path.join(outputDir, "docker-compose.qa.yml"),
      path.join(outputDir, "state", "quiet-core-bot.json"),
      path.join(outputDir, "state", "seed-workspace", "QA_KICKOFF_TASK.md"),
      path.join(outputDir, "state", "seed-workspace", "QA_SCENARIO_PLAN.md"),
      path.join(outputDir, "state", "seed-workspace", "QA_SCENARIOS.yaml"),
      path.join(outputDir, "state", "seed-workspace", "IDENTITY.md"),
    ]) {
      expect(result.files).toContain(expectedFile);
    }

    const compose = await readFile(path.join(outputDir, "docker-compose.qa.yml"), "utf8");
    const services = parseComposeServices(compose);
    expect(compose).toContain("image: quiet-core-bot:qa-local-prebaked");
    expect(compose).toContain("qa-mock-openai:");
    expect(services["qa-mock-openai"]?.environment).toMatchObject({
      QUIET_CORE_ENABLE_PRIVATE_QA_CLI: "1",
      QUIET_CORE_PROFILE: "",
    });
    expect(services["qa-mock-openai"]?.environment).not.toHaveProperty("QUIET_CORE_CONFIG_PATH");
    expect(services["qa-mock-openai"]?.volumes).toBeUndefined();
    expect(services["qa-lab"]?.environment).toMatchObject({
      QUIET_CORE_ENABLE_PRIVATE_QA_CLI: "1",
      QUIET_CORE_CONFIG_PATH: "/opt/quiet-core-bot-scaffold/quiet-core-bot.json",
      QUIET_CORE_STATE_DIR: "/tmp/quiet-core-bot/state",
    });
    expect(services["qa-lab"]?.volumes).toContain("./state:/opt/quiet-core-bot-scaffold:ro");
    expect(compose).toContain('      - "127.0.0.1:18889:18789"');
    expect(compose).toContain('      - "127.0.0.1:43124:43123"');
    expect(compose).toContain(":/opt/quiet-core-bot-qa-lab-ui:ro");
    expect(compose).toContain("      - sh");
    expect(compose).toContain("      - -lc");
    expect(compose).toContain(
      '        - fetch("http://127.0.0.1:18789/healthz").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))',
    );
    expect(compose).toContain("--control-ui-proxy-target http://quiet-core-bot-qa-gateway:18789/");
    expect(compose).not.toContain("--control-ui-token");
    expect(compose).not.toContain("qa-token");
    expect(compose).toContain("--send-kickoff-on-start");
    expect(compose).toContain("--ui-dist-dir /opt/quiet-core-bot-qa-lab-ui");
    expect(compose).toContain(":/opt/quiet-core-bot-repo:ro");
    expect(compose).toContain("./state:/opt/quiet-core-bot-scaffold:ro");
    expect(compose).toContain(
      "cp -R /opt/quiet-core-bot-scaffold/seed-workspace/. /tmp/quiet-core-bot/workspace/ && rm -rf /tmp/quiet-core-bot/workspace/repo && ln -s /opt/quiet-core-bot-repo /tmp/quiet-core-bot/workspace/repo",
    );
    expect(compose).toContain("QUIET_CORE_CONFIG_PATH: /tmp/quiet-core-bot/quiet-core-bot.json");
    expect(compose).toContain("QUIET_CORE_STATE_DIR: /tmp/quiet-core-bot/state");
    expect(compose).toContain('QUIET_CORE_NO_RESPAWN: "1"');

    const envExample = await readFile(path.join(outputDir, ".env.example"), "utf8");
    expect(envExample).toContain("QUIET_CORE_GATEWAY_TOKEN=qa-token");
    expect(envExample).toContain("QA_BUS_BASE_URL=http://qa-lab:43123");
    expect(envExample).toContain("QA_PROVIDER_BASE_URL=http://host.docker.internal:45123/v1");
    expect(envExample).toContain("QA_LAB_URL=http://127.0.0.1:43124");

    const configText = await readFile(path.join(outputDir, "state", "quiet-core-bot.json"), "utf8");
    const config = JSON.parse(configText) as {
      plugins?: {
        allow?: string[];
        entries?: Record<string, { enabled?: boolean }>;
      };
    };
    expect(configText).toContain('"allowInsecureAuth": true');
    expect(configText).toContain('"pluginToolsMcpBridge": true');
    expect(configText).toContain('"openClawToolsMcpBridge": true');
    expect(configText).toContain("/app/dist/control-ui");
    expect(configText).toContain("C-3PO QA");
    expect(configText).toContain('"/tmp/quiet-core-bot/workspace"');
    expect(config.plugins?.allow).toContain("qa-lab");
    expect(config.plugins?.entries?.["qa-lab"]?.enabled).toBe(true);

    const kickoff = await readFile(
      path.join(outputDir, "state", "seed-workspace", "QA_KICKOFF_TASK.md"),
      "utf8",
    );
    expect(kickoff).toContain("Lobster Invaders");

    const scenarios = await readFile(
      path.join(outputDir, "state", "seed-workspace", "QA_SCENARIOS.yaml"),
      "utf8",
    );
    expect(scenarios).toContain("pack:");
    expect(scenarios).toContain("subagent-fanout-synthesis");

    const readme = await readFile(path.join(outputDir, "README.md"), "utf8");
    expect(readme).toContain("in-process restarts inside Docker");
    expect(readme).toContain("pnpm qa:lab:watch");
  });

  it("builds the reusable QA image with bundled QA extensions", async () => {
    const calls: string[] = [];
    const result = await buildQaDockerHarnessImage(
      {
        repoRoot: "/repo/quiet-core-bot",
        imageName: "quiet-core-bot:qa-local-prebaked",
      },
      {
        async runCommand(command, args, cwd) {
          calls.push([command, ...args, `@${cwd}`].join(" "));
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(result.imageName).toBe("quiet-core-bot:qa-local-prebaked");
    expect(calls).toEqual([
      "docker build -t quiet-core-bot:qa-local-prebaked --build-arg QUIET_CORE_EXTENSIONS=qa-channel qa-lab -f Dockerfile . @/repo/quiet-core-bot",
    ]);
  });

  it("quotes generated compose paths so shell-sensitive repo paths survive YAML parsing", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "qa-docker-paths-"));
    const outputDir = path.join(tempRoot, "scaffold");
    const repoRoot = path.join(tempRoot, "repo #hash");
    cleanups.push(async () => {
      await rm(tempRoot, { recursive: true, force: true });
    });
    await mkdir(repoRoot, { recursive: true });

    await writeQaDockerHarnessFiles({
      outputDir,
      repoRoot,
      gatewayToken: "qa-token",
      usePrebuiltImage: false,
      bindUiDist: true,
    });

    const compose = await readFile(path.join(outputDir, "docker-compose.qa.yml"), "utf8");
    const services = parseComposeServices(compose);
    expect(services["qa-mock-openai"]?.build?.context).toBe("../repo #hash");
    expect(services["qa-lab"]?.volumes).toContain(
      "../repo #hash/extensions/qa-lab/web/dist:/opt/quiet-core-bot-qa-lab-ui:ro",
    );
    expect(services["quiet-core-bot-qa-gateway"]?.volumes).toContain(
      "../repo #hash:/opt/quiet-core-bot-repo:ro",
    );
  });
});
