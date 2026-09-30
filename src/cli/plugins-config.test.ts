// Plugin config tests cover plugin config command parsing and output formatting.
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { setPluginEnabledInConfig } from "./plugins-config.js";

describe("setPluginEnabledInConfig", () => {
  it("sets enabled flag for an existing plugin entry", () => {
    const config = {
      plugins: {
        entries: {
          alpha: { enabled: false, custom: "x" },
        },
      },
    } as OpenClawConfig;

    const next = setPluginEnabledInConfig(config, "alpha", true);

    expect(next.plugins?.entries?.alpha).toEqual({
      enabled: true,
      custom: "x",
    });
  });

  it("creates a plugin entry when it does not exist", () => {
    const config = {} as OpenClawConfig;

    const next = setPluginEnabledInConfig(config, "beta", false);

    expect(next.plugins?.entries?.beta).toEqual({
      enabled: false,
    });
  });

  it("keeps built-in channel and plugin entry flags in sync", () => {
    const config = {
      channels: {
        signal: {
          enabled: true,
          dmPolicy: "open",
        },
      },
      plugins: {
        entries: {
          signal: {
            enabled: true,
          },
        },
      },
    } as OpenClawConfig;

    const disabled = setPluginEnabledInConfig(config, "signal", false);
    expect(disabled.channels?.signal).toEqual({
      enabled: false,
      dmPolicy: "open",
    });
    expect(disabled.plugins?.entries?.signal).toEqual({
      enabled: false,
    });

    const reenabled = setPluginEnabledInConfig(disabled, "signal", true);
    expect(reenabled.channels?.signal).toEqual({
      enabled: true,
      dmPolicy: "open",
    });
    expect(reenabled.plugins?.entries?.signal).toEqual({
      enabled: true,
    });
  });
});
