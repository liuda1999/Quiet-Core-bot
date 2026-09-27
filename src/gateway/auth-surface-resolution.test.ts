// Interactive surface auth tests document token precedence for remote gateway
// surfaces that need browser or control-UI access.
import { describe, expect, it } from "vitest";
import type { GatewayRemoteConfig } from "../config/types.gateway.js";
import type { OpenClawConfig } from "../config/types.quiet-core-bot.js";
import { resolveGatewayInteractiveSurfaceAuth } from "./auth-surface-resolution.js";

function remoteGatewayConfig(remote?: GatewayRemoteConfig): OpenClawConfig {
  return {
    gateway: {
      mode: "remote",
      remote: {
        url: "wss://remote.example/ws",
        ...remote,
      },
    },
  };
}

describe("resolveGatewayInteractiveSurfaceAuth", () => {
  it("uses QUIET_CORE_GATEWAY_TOKEN as remote interactive fallback", async () => {
    await expect(
      resolveGatewayInteractiveSurfaceAuth({
        config: remoteGatewayConfig(),
        env: {
          QUIET_CORE_GATEWAY_TOKEN: "env-token",
        },
        surface: "remote",
      }),
    ).resolves.toEqual({
      token: "env-token",
      password: undefined,
    });
  });

  it("keeps configured remote token ahead of QUIET_CORE_GATEWAY_TOKEN", async () => {
    await expect(
      resolveGatewayInteractiveSurfaceAuth({
        config: remoteGatewayConfig({ token: "remote-token" }),
        env: {
          QUIET_CORE_GATEWAY_TOKEN: "env-token",
        },
        surface: "remote",
      }),
    ).resolves.toEqual({
      token: "remote-token",
      password: undefined,
    });
  });

  it("falls back to QUIET_CORE_GATEWAY_TOKEN when the remote token ref is unresolved", async () => {
    await expect(
      resolveGatewayInteractiveSurfaceAuth({
        config: {
          ...remoteGatewayConfig({
            token: { source: "env", provider: "default", id: "MISSING_REMOTE_TOKEN" },
          }),
        },
        env: {
          QUIET_CORE_GATEWAY_TOKEN: "env-token",
        },
        surface: "remote",
      }),
    ).resolves.toEqual({
      token: "env-token",
      password: undefined,
    });
  });
});
