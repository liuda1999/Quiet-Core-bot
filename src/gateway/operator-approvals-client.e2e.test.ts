// Operator approvals client e2e tests verify requester/approver scope behavior through a real gateway server.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearConfigCache, clearRuntimeConfigSnapshot } from "../config/config.js";
import { clearSessionStoreCacheForTest } from "../config/sessions/store.js";
import type { OpenClawConfig } from "../config/types.quiet-core-bot.js";
import { captureEnv, deleteTestEnvValue, setTestEnvValue } from "../test-utils/env.js";
import { removeTestTempPath } from "../test-utils/session-state-cleanup.js";
import { ADMIN_SCOPE, APPROVALS_SCOPE } from "./method-scopes.js";
import { withOperatorApprovalsGatewayClient } from "./operator-approvals-client.js";
import { startGatewayServer } from "./server.js";
import {
  connectGatewayClient,
  disconnectGatewayClient,
  getFreeGatewayPort,
} from "./test-helpers.e2e.js";

const TEST_ENV_KEYS = [
  "HOME",
  "QUIET_CORE_STATE_DIR",
  "QUIET_CORE_CONFIG_PATH",
  "QUIET_CORE_GATEWAY_URL",
  "QUIET_CORE_GATEWAY_TOKEN",
  "QUIET_CORE_GATEWAY_PASSWORD",
  "QUIET_CORE_GATEWAY_PORT",
];

type Cleanup = () => Promise<void> | void;

async function requestExecApproval(params: {
  requester: Awaited<ReturnType<typeof connectGatewayClient>>;
  id: string;
}): Promise<void> {
  await expect(
    params.requester.request("exec.approval.request", {
      id: params.id,
      command: "printf smoke",
      cwd: "/tmp",
      host: "local",
      ask: "always",
      twoPhase: true,
      timeoutMs: 60_000,
    }),
  ).resolves.toMatchObject({
    status: "accepted",
    id: params.id,
  });
}

describe("operator approval gateway client runtime token source", () => {
  const cleanup: Cleanup[] = [];

  afterEach(async () => {
    for (const step of cleanup.splice(0).toReversed()) {
      await step();
    }
    clearRuntimeConfigSnapshot();
    clearConfigCache();
    clearSessionStoreCacheForTest();
  });

  it("uses runtime authority only for generated local gateway URLs", async () => {
    const envSnapshot = captureEnv(TEST_ENV_KEYS);
    cleanup.push(() => envSnapshot.restore());
    deleteTestEnvValue("QUIET_CORE_CONFIG_PATH");
    deleteTestEnvValue("QUIET_CORE_GATEWAY_URL");
    deleteTestEnvValue("QUIET_CORE_GATEWAY_TOKEN");
    deleteTestEnvValue("QUIET_CORE_GATEWAY_PASSWORD");

    const tempHome = await fs.mkdtemp(
      path.join(os.tmpdir(), "quiet-core-bot-approval-client-e2e-"),
    );
    cleanup.push(() => removeTestTempPath(tempHome));

    const stateDir = path.join(tempHome, ".quiet-core-bot");
    await fs.mkdir(stateDir, { recursive: true });
    setTestEnvValue("HOME", tempHome);
    setTestEnvValue("QUIET_CORE_STATE_DIR", stateDir);

    const port = await getFreeGatewayPort();
    const token = "approval-client-e2e-token";
    const url = `ws://127.0.0.1:${port}`;
    setTestEnvValue("QUIET_CORE_GATEWAY_PORT", String(port));

    const server = await startGatewayServer(port, {
      bind: "loopback",
      auth: { mode: "token", token },
      controlUiEnabled: false,
      deferStartupSidecars: true,
    });
    cleanup.push(() => server.close());

    const admin = await connectGatewayClient({
      url,
      token,
      clientDisplayName: "approval admin",
      scopes: [ADMIN_SCOPE],
      timeoutMs: 60_000,
    });
    cleanup.push(() => disconnectGatewayClient(admin));

    const requester = await connectGatewayClient({
      url,
      token,
      clientDisplayName: "approval requester",
      scopes: [APPROVALS_SCOPE],
      timeoutMs: 60_000,
    });
    cleanup.push(() => disconnectGatewayClient(requester));

    const localConfig = {
      gateway: {
        port,
        auth: { mode: "token", token },
      },
    } satisfies OpenClawConfig;

    await requestExecApproval({ requester, id: "local-source-approval" });
    await withOperatorApprovalsGatewayClient(
      {
        config: localConfig,
        clientDisplayName: "local source approval resolver",
      },
      async (client) => {
        await client.request(
          "exec.approval.resolve",
          { id: "local-source-approval", decision: "allow-once" },
          { timeoutMs: 10_000 },
        );
      },
    );

    const remoteLoopbackConfig = {
      gateway: {
        mode: "remote",
        remote: { url },
        auth: { mode: "token", token },
      },
    } satisfies OpenClawConfig;

    await requestExecApproval({ requester, id: "remote-loopback-approval" });
    await expect(
      withOperatorApprovalsGatewayClient(
        {
          config: remoteLoopbackConfig,
          clientDisplayName: "remote loopback approval resolver",
        },
        async (client) => {
          await client.request(
            "exec.approval.resolve",
            { id: "remote-loopback-approval", decision: "allow-once" },
            { timeoutMs: 10_000 },
          );
        },
      ),
    ).rejects.toMatchObject({
      gatewayCode: "INVALID_REQUEST",
      details: { reason: "APPROVAL_NOT_FOUND" },
    });

    await admin.request(
      "exec.approval.resolve",
      { id: "remote-loopback-approval", decision: "deny" },
      { timeoutMs: 10_000 },
    );
  }, 120_000);
});
