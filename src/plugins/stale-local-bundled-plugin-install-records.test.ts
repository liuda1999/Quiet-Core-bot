// Covers stale local bundled plugin install record detection.
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PluginInstallRecord } from "../config/types.plugins.js";
import type { BundledPluginSource } from "./bundled-sources.js";
import {
  listStaleLocalBundledPluginInstallRecords,
  pruneStaleLocalBundledPluginInstallRecords,
} from "./stale-local-bundled-plugin-install-records.js";

function bundledSource(pluginId: string, localPath: string): Map<string, BundledPluginSource> {
  return new Map([
    [
      pluginId,
      {
        pluginId,
        localPath,
        version: "2026.5.20",
      },
    ],
  ]);
}

describe("listStaleLocalBundledPluginInstallRecords", () => {
  it("lists path install records that point at stale compiled bundled output", () => {
    const currentPath = path.resolve("/opt/quiet-core-bot", "dist", "extensions", "irc");
    const stalePath = path.resolve("/tmp/old-quiet-core-bot", "dist", "extensions", "irc");
    const records: Record<string, PluginInstallRecord> = {
      irc: {
        source: "path",
        installPath: stalePath,
        version: "2026.5.4-beta.3",
      },
      tlon: {
        source: "npm",
        installPath: "/tmp/plugins/tlon",
      },
    };

    expect(
      listStaleLocalBundledPluginInstallRecords({
        installRecords: records,
        bundled: bundledSource("irc", currentPath),
      }),
    ).toStrictEqual([
      {
        pluginId: "irc",
        record: records.irc,
        recordPathField: "installPath",
        stalePath,
        bundledPath: currentPath,
      },
    ]);
  });

  it("does not list the current bundled path", () => {
    const currentPath = path.resolve("/opt/quiet-core-bot", "dist", "extensions", "irc");

    expect(
      listStaleLocalBundledPluginInstallRecords({
        installRecords: {
          irc: {
            source: "path",
            installPath: currentPath,
            version: "2026.5.4-beta.3",
          },
        },
        bundled: bundledSource("irc", currentPath),
      }),
    ).toStrictEqual([]);
  });

  it("does not list compiled bundled paths without a stale version", () => {
    const currentPath = path.resolve("/opt/quiet-core-bot", "dist", "extensions", "irc");

    expect(
      listStaleLocalBundledPluginInstallRecords({
        installRecords: {
          irc: {
            source: "path",
            installPath: path.resolve("/tmp/local-quiet-core-bot", "dist", "extensions", "irc"),
          },
          acpx: {
            source: "path",
            installPath: path.resolve("/tmp/local-quiet-core-bot", "dist", "extensions", "acpx"),
            version: "2026.5.20",
          },
        },
        bundled: new Map([
          ...bundledSource("irc", currentPath),
          ...bundledSource(
            "acpx",
            path.resolve("/opt/quiet-core-bot", "dist", "extensions", "acpx"),
          ),
        ]),
      }),
    ).toStrictEqual([]);
  });

  it("does not list source checkout or arbitrary local plugin paths", () => {
    const currentPath = path.resolve("/opt/quiet-core-bot", "dist", "extensions", "irc");

    expect(
      listStaleLocalBundledPluginInstallRecords({
        installRecords: {
          irc: {
            source: "path",
            installPath: path.resolve("/tmp/quiet-core-bot", "extensions", "irc"),
            version: "2026.5.4-beta.3",
          },
          acpx: {
            source: "path",
            installPath: path.resolve("/tmp/custom-plugins", "acpx"),
            version: "2026.5.4-beta.3",
          },
        },
        bundled: new Map([
          ...bundledSource("irc", currentPath),
          ...bundledSource(
            "acpx",
            path.resolve("/opt/quiet-core-bot", "dist", "extensions", "acpx"),
          ),
        ]),
      }),
    ).toStrictEqual([]);
  });
});

describe("pruneStaleLocalBundledPluginInstallRecords", () => {
  it("removes only stale local bundled plugin install records", () => {
    const currentPath = path.resolve("/opt/quiet-core-bot", "dist", "extensions", "irc");
    const stalePath = path.resolve("/tmp/old-quiet-core-bot", "dist", "extensions", "irc");
    const records: Record<string, PluginInstallRecord> = {
      irc: {
        source: "path",
        installPath: stalePath,
        version: "2026.5.4-beta.3",
      },
      tlon: {
        source: "npm",
        installPath: "/tmp/plugins/tlon",
      },
    };

    expect(
      pruneStaleLocalBundledPluginInstallRecords({
        installRecords: records,
        bundled: bundledSource("irc", currentPath),
      }),
    ).toStrictEqual({
      records: {
        tlon: records.tlon,
      },
      stale: [
        {
          pluginId: "irc",
          record: records.irc,
          recordPathField: "installPath",
          stalePath,
          bundledPath: currentPath,
        },
      ],
    });
  });
});
