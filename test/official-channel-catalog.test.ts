// Official channel catalog tests validate catalog metadata and entries.
import fs from "node:fs";
import path from "node:path";
import { bundledPluginRoot } from "quiet-core-bot/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildOfficialChannelCatalog,
  OFFICIAL_CHANNEL_CATALOG_RELATIVE_PATH,
  writeOfficialChannelCatalog,
} from "../scripts/write-official-channel-catalog.mjs";
import { describePluginInstallSource } from "../src/plugins/install-source-info.js";
import { cleanupTempDirs, makeTempRepoRoot, writeJsonFile } from "./helpers/temp-repo.js";

const tempDirs: string[] = [];

type OfficialChannelCatalogEntry = ReturnType<
  typeof buildOfficialChannelCatalog
>["entries"][number];
type OfficialChannelInstall = NonNullable<
  NonNullable<OfficialChannelCatalogEntry["quiet-core-bot"]>["install"]
>;

function makeRepoRoot(prefix: string): string {
  return makeTempRepoRoot(tempDirs, prefix);
}

function writeJson(filePath: string, value: unknown): void {
  writeJsonFile(filePath, value);
}

function requireInstall(entry: OfficialChannelCatalogEntry | undefined): OfficialChannelInstall {
  const install = entry?.["quiet-core-bot"]?.install;
  if (!install) {
    throw new Error("expected official channel install config");
  }
  return install;
}

function requireNpmInstallSource(source: ReturnType<typeof describePluginInstallSource>) {
  if (!source.npm) {
    throw new Error("expected npm install source");
  }
  return source.npm;
}

function findCatalogEntry(
  entries: OfficialChannelCatalogEntry[],
  predicate: (entry: OfficialChannelCatalogEntry) => boolean,
): OfficialChannelCatalogEntry {
  const entry = entries.find(predicate);
  if (!entry) {
    throw new Error("expected official channel catalog entry");
  }
  return entry;
}

function summarizeCatalogEntry(entry: OfficialChannelCatalogEntry) {
  return {
    name: entry.name,
    description: entry.description,
    source: entry.source,
    plugin: entry["quiet-core-bot"]?.plugin,
    channel: entry["quiet-core-bot"]?.channel,
    install: entry["quiet-core-bot"]?.install,
  };
}

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

describe("buildOfficialChannelCatalog", () => {
  it("includes publishable official channel plugins and skips non-publishable entries", () => {
    const repoRoot = makeRepoRoot("quiet-core-bot-official-channel-catalog-");
    writeJson(path.join(repoRoot, "extensions", "whatsapp", "package.json"), {
      name: "@quiet-core/whatsapp",
      version: "2026.3.23",
      description: "Quiet Core bot WhatsApp channel plugin",
      "quiet-core-bot": {
        channel: {
          id: "whatsapp",
          label: "WhatsApp",
          selectionLabel: "WhatsApp (QR link)",
          detailLabel: "WhatsApp Web",
          docsPath: "/channels/whatsapp",
          blurb: "works with your own number; recommend a separate phone + eSIM.",
        },
        install: {
          clawhubSpec: "clawhub:@quiet-core/whatsapp",
          npmSpec: "@quiet-core/whatsapp",
          localPath: bundledPluginRoot("whatsapp"),
          defaultChoice: "clawhub",
        },
        release: {
          publishToNpm: true,
        },
      },
    });
    writeJson(path.join(repoRoot, "extensions", "local-only", "package.json"), {
      name: "@quiet-core/local-only",
      "quiet-core-bot": {
        channel: {
          id: "local-only",
          label: "Local Only",
          selectionLabel: "Local Only",
          docsPath: "/channels/local-only",
          blurb: "dev only",
        },
        install: {
          localPath: bundledPluginRoot("local-only"),
        },
        release: {
          publishToNpm: false,
        },
      },
    });

    const entries = buildOfficialChannelCatalog({ repoRoot }).entries;

    expect(
      summarizeCatalogEntry(
        findCatalogEntry(entries, (entry) => entry.name === "@wecom/wecom-quiet-core-bot-plugin"),
      ),
    ).toEqual({
      name: "@wecom/wecom-quiet-core-bot-plugin",
      description: "Quiet Core bot WeCom channel plugin by the Tencent WeCom team.",
      source: "external",
      plugin: {
        id: "wecom-quiet-core-bot-plugin",
        label: "WeCom",
      },
      channel: {
        id: "wecom",
        label: "WeCom",
        selectionLabel: "WeCom（企业微信）",
        detailLabel: "WeCom",
        docsLabel: "wecom",
        docsPath: "/plugins/community#wecom",
        blurb: "Enterprise messaging and documents, scheduling, task tools.",
        order: 45,
        aliases: ["qywx", "wework", "enterprise-wechat"],
      },
      install: {
        npmSpec: "@wecom/wecom-quiet-core-bot-plugin@2026.5.7",
        defaultChoice: "npm",
        expectedIntegrity:
          "sha512-TCkP9as00WfEhgFWG8YL/rcmaWGIshAki2HQh83nTRccGfVBCoGjrEboTTqq3yDmK9koWTV11zi8u8A4dNtvug==",
      },
    });
    expect(
      summarizeCatalogEntry(
        findCatalogEntry(entries, (entry) => entry.name === "quiet-core-bot-plugin-yuanbao"),
      ),
    ).toEqual({
      name: "quiet-core-bot-plugin-yuanbao",
      description: "Quiet Core bot Yuanbao channel plugin by the Tencent Yuanbao team.",
      source: "external",
      plugin: {
        id: "quiet-core-bot-plugin-yuanbao",
        label: "Yuanbao",
      },
      channel: {
        id: "yuanbao",
        label: "Yuanbao",
        selectionLabel: "Yuanbao (元宝)",
        detailLabel: "Yuanbao",
        docsLabel: "yuanbao",
        docsPath: "/plugins/community#yuanbao",
        blurb: "Tencent Yuanbao AI assistant conversation channel.",
        order: 85,
        aliases: ["yuanbao", "yb", "tencent-yuanbao", "元宝"],
      },
      install: {
        npmSpec: "quiet-core-bot-plugin-yuanbao@2.15.0",
        defaultChoice: "npm",
        expectedIntegrity:
          "sha512-3GD+mf3EjTSUTOAREjTHAyp/deXdpgqB+q+xE0b19Qtat4ADhUV1mHDwFkVCRqTCBY5ATFKtKcipoDejqFj/+w==",
      },
    });
    expect(
      summarizeCatalogEntry(
        findCatalogEntry(entries, (entry) => entry.name === "@quiet-core/whatsapp"),
      ),
    ).toEqual({
      name: "@quiet-core/whatsapp",
      description: "Quiet Core bot WhatsApp channel plugin",
      source: "official",
      plugin: undefined,
      channel: {
        id: "whatsapp",
        label: "WhatsApp",
        selectionLabel: "WhatsApp (QR link)",
        detailLabel: "WhatsApp Web",
        docsLabel: "whatsapp",
        docsPath: "/channels/whatsapp",
        blurb: "works with your own number; recommend a separate phone + eSIM.",
        systemImage: "message",
      },
      install: {
        clawhubSpec: "clawhub:@quiet-core/whatsapp",
        npmSpec: "@quiet-core/whatsapp",
        defaultChoice: "clawhub",
        minHostVersion: ">=2026.4.25",
      },
    });
  });

  it("keeps third-party official external catalog npm sources exactly pinned", () => {
    const repoRoot = makeRepoRoot("quiet-core-bot-official-channel-catalog-policy-");
    const entries = buildOfficialChannelCatalog({ repoRoot }).entries.filter(
      (entry) => entry.source === "external" && !entry.name?.startsWith("@quiet-core/"),
    );

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const installSource = describePluginInstallSource(requireInstall(entry));
      expect(installSource.warnings).toStrictEqual([]);
      expect(requireNpmInstallSource(installSource).pinState).toBe("exact-with-integrity");
    }
  });

  it("allows official Quiet Core bot channel npm specs without integrity during launch", () => {
    const repoRoot = makeRepoRoot("quiet-core-bot-official-channel-catalog-quiet-core-bot-policy-");
    const twitch = buildOfficialChannelCatalog({ repoRoot }).entries.find(
      (entry) => entry["quiet-core-bot"]?.channel?.id === "twitch",
    );

    expect({
      name: twitch?.name,
      install: twitch?.["quiet-core-bot"]?.install,
    }).toEqual({
      name: "@quiet-core/twitch",
      install: {
        npmSpec: "@quiet-core/twitch",
        defaultChoice: "npm",
        minHostVersion: ">=2026.4.10",
      },
    });
    const installSource = describePluginInstallSource(requireInstall(twitch));
    expect(requireNpmInstallSource(installSource).pinState).toBe("floating-without-integrity");
    expect(installSource.warnings).toEqual(["npm-spec-floating", "npm-spec-missing-integrity"]);
  });

  it("preserves ClawHub specs when generating publishable channel catalog entries", () => {
    const repoRoot = makeRepoRoot("quiet-core-bot-official-channel-catalog-clawhub-");
    writeJson(path.join(repoRoot, "extensions", "storepack-chat", "package.json"), {
      name: "@quiet-core/storepack-chat",
      "quiet-core-bot": {
        channel: {
          id: "storepack-chat",
          label: "Storepack Chat",
          selectionLabel: "Storepack Chat",
          docsPath: "/channels/storepack-chat",
          blurb: "storepack-first channel",
        },
        install: {
          clawhubSpec: "clawhub:@quiet-core/storepack-chat",
          npmSpec: "@quiet-core/storepack-chat",
          defaultChoice: "clawhub",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    const entry = buildOfficialChannelCatalog({ repoRoot }).entries.find(
      (candidate) => candidate["quiet-core-bot"]?.channel?.id === "storepack-chat",
    );

    expect(requireInstall(entry)).toEqual({
      clawhubSpec: "clawhub:@quiet-core/storepack-chat",
      npmSpec: "@quiet-core/storepack-chat",
      defaultChoice: "clawhub",
    });
  });

  it("writes the official catalog under dist", () => {
    const repoRoot = makeRepoRoot("quiet-core-bot-official-channel-catalog-write-");
    writeJson(path.join(repoRoot, "extensions", "whatsapp", "package.json"), {
      name: "@quiet-core/whatsapp",
      "quiet-core-bot": {
        channel: {
          id: "whatsapp",
          label: "WhatsApp",
          selectionLabel: "WhatsApp",
          docsPath: "/channels/whatsapp",
          blurb: "wa",
        },
        install: {
          npmSpec: "@quiet-core/whatsapp",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    writeOfficialChannelCatalog({ repoRoot });

    const outputPath = path.join(repoRoot, OFFICIAL_CHANNEL_CATALOG_RELATIVE_PATH);
    expect(fs.existsSync(outputPath)).toBe(true);
    const entries = JSON.parse(fs.readFileSync(outputPath, "utf8")).entries;
    expect(entries.map((entry: { name?: string }) => entry.name)).toContain(
      "@wecom/wecom-quiet-core-bot-plugin",
    );
    expect(entries.map((entry: { name?: string }) => entry.name)).toContain(
      "quiet-core-bot-plugin-yuanbao",
    );
    const whatsappEntry = findCatalogEntry(
      entries,
      (entry: { "quiet-core-bot"?: { channel?: { id?: string } } }) =>
        entry["quiet-core-bot"]?.channel?.id === "whatsapp",
    );
    expect(summarizeCatalogEntry(whatsappEntry)).toEqual({
      name: "@quiet-core/whatsapp",
      description: "Quiet Core bot WhatsApp channel plugin",
      source: "official",
      plugin: undefined,
      channel: {
        id: "whatsapp",
        label: "WhatsApp",
        selectionLabel: "WhatsApp (QR link)",
        detailLabel: "WhatsApp Web",
        docsLabel: "whatsapp",
        docsPath: "/channels/whatsapp",
        blurb: "works with your own number; recommend a separate phone + eSIM.",
        systemImage: "message",
      },
      install: {
        clawhubSpec: "clawhub:@quiet-core/whatsapp",
        npmSpec: "@quiet-core/whatsapp",
        defaultChoice: "clawhub",
        minHostVersion: ">=2026.4.25",
      },
    });
    const whatsappEntries = entries.filter(
      (entry: { "quiet-core-bot"?: { channel?: { id?: string } } }) =>
        entry["quiet-core-bot"]?.channel?.id === "whatsapp",
    );
    expect(whatsappEntries).toHaveLength(1);
  });
});
