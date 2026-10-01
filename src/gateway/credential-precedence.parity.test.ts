// Credential precedence parity tests keep call, probe, status, and auth surfaces
// aligned on local/remote gateway token and password resolution.
import { describe, expect, it } from "vitest";
import { resolveGatewayProbeAuthResolution } from "../commands/status.gateway-probe.js";
import type { QuietCoreConfig } from "../config/config.js";
import { withEnv } from "../test-utils/env.js";
import { resolveGatewayAuth } from "./auth.js";
import { resolveGatewayCredentialsFromConfig } from "./credentials.js";
import { resolveGatewayProbeAuth } from "./probe-auth.js";

type ExpectedCredentialSet = {
  call: { token?: string; password?: string };
  probe: { token?: string; password?: string };
  status: { token?: string; password?: string };
  auth: { token?: string; password?: string };
};

type TestCase = {
  name: string;
  cfg: QuietCoreConfig;
  env: NodeJS.ProcessEnv;
  expected: ExpectedCredentialSet;
};

const gatewayEnv = {
  QUIET_CORE_GATEWAY_TOKEN: "env-token", // pragma: allowlist secret
  QUIET_CORE_GATEWAY_PASSWORD: "env-password", // pragma: allowlist secret
} as NodeJS.ProcessEnv;

function makeRemoteGatewayConfig(remote: { token?: string; password?: string }): QuietCoreConfig {
  return {
    gateway: {
      mode: "remote",
      remote,
      auth: {
        token: "local-token",
        password: "local-password", // pragma: allowlist secret
      },
    },
  } as QuietCoreConfig;
}

function withGatewayAuthEnv<T>(env: NodeJS.ProcessEnv, fn: () => T): T {
  return withEnv(
    {
      QUIET_CORE_GATEWAY_TOKEN: env.QUIET_CORE_GATEWAY_TOKEN,
      QUIET_CORE_GATEWAY_PASSWORD: env.QUIET_CORE_GATEWAY_PASSWORD,
      QUIET_CORE_SERVICE_KIND: env.QUIET_CORE_SERVICE_KIND,
    },
    fn,
  );
}

describe("gateway credential precedence coverage", () => {
  const cases: TestCase[] = [
    {
      name: "local mode: env overrides config for call/probe/status, auth remains config-first",
      cfg: {
        gateway: {
          mode: "local",
          auth: {
            token: "config-token",
            password: "config-password", // pragma: allowlist secret
          },
        },
      } as QuietCoreConfig,
      env: {
        QUIET_CORE_GATEWAY_TOKEN: "env-token", // pragma: allowlist secret
        QUIET_CORE_GATEWAY_PASSWORD: "env-password", // pragma: allowlist secret
      } as NodeJS.ProcessEnv,
      expected: {
        call: { token: "env-token", password: "env-password" }, // pragma: allowlist secret
        probe: { token: "env-token", password: "env-password" }, // pragma: allowlist secret
        status: { token: "config-token", password: "config-password" }, // pragma: allowlist secret
        auth: { token: "config-token", password: "config-password" }, // pragma: allowlist secret
      },
    },
    {
      name: "remote mode with remote token configured",
      cfg: makeRemoteGatewayConfig({
        token: "remote-token",
        password: "remote-password", // pragma: allowlist secret
      }),
      env: gatewayEnv,
      expected: {
        call: { token: "remote-token", password: "env-password" }, // pragma: allowlist secret
        probe: { token: "remote-token", password: "env-password" }, // pragma: allowlist secret
        status: { token: "local-token", password: "local-password" }, // pragma: allowlist secret
        auth: { token: "local-token", password: "local-password" }, // pragma: allowlist secret
      },
    },
    {
      name: "remote mode without remote token keeps remote probe/status strict",
      cfg: makeRemoteGatewayConfig({
        password: "remote-password", // pragma: allowlist secret
      }),
      env: gatewayEnv,
      expected: {
        call: { token: "env-token", password: "env-password" }, // pragma: allowlist secret
        probe: { token: undefined, password: "env-password" }, // pragma: allowlist secret
        status: { token: "local-token", password: "local-password" }, // pragma: allowlist secret
        auth: { token: "local-token", password: "local-password" }, // pragma: allowlist secret
      },
    },
    {
      name: "local mode in gateway service runtime uses config-first token precedence",
      cfg: {
        gateway: {
          mode: "local",
          auth: {
            token: "config-token",
            password: "config-password", // pragma: allowlist secret
          },
        },
      } as QuietCoreConfig,
      env: {
        QUIET_CORE_GATEWAY_TOKEN: "env-token",
        QUIET_CORE_GATEWAY_PASSWORD: "env-password", // pragma: allowlist secret
        QUIET_CORE_SERVICE_KIND: "gateway",
      } as NodeJS.ProcessEnv,
      expected: {
        call: { token: "config-token", password: "env-password" }, // pragma: allowlist secret
        probe: { token: "config-token", password: "env-password" }, // pragma: allowlist secret
        status: { token: "config-token", password: "config-password" }, // pragma: allowlist secret
        auth: { token: "config-token", password: "config-password" }, // pragma: allowlist secret
      },
    },
  ];

  it.each(cases)("$name", async ({ cfg, env, expected }) => {
    const mode = cfg.gateway?.mode === "remote" ? "remote" : "local";
    const call = resolveGatewayCredentialsFromConfig({
      cfg,
      env,
    });
    const probe = resolveGatewayProbeAuth({
      cfg,
      mode,
      env,
    });
    const status = (await withGatewayAuthEnv(env, () => resolveGatewayProbeAuthResolution(cfg)))
      .auth;
    const auth = resolveGatewayAuth({
      authConfig: cfg.gateway?.auth,
      env,
    });

    expect(call).toEqual(expected.call);
    expect(probe).toEqual(expected.probe);
    expect(status).toEqual(expected.status);
    expect({ token: auth.token, password: auth.password }).toEqual(expected.auth);
  });
});
