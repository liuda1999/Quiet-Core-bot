import { describe, expect, it } from "vitest";
import {
  type OfficialExternalPluginCatalogEntry,
  getOfficialExternalPluginCatalogEntry,
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalProviderContractPluginIds,
  resolveOfficialExternalProviderPluginIds,
  resolveOfficialExternalProviderPluginIdsForEnv,
  resolveOfficialExternalWebProviderContractPluginIdsForEnv,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall,
} from "./official-external-plugin-catalog.js";

function expectCatalogEntry(id: string): OfficialExternalPluginCatalogEntry {
  const entry = getOfficialExternalPluginCatalogEntry(id);
  if (entry === undefined) {
    throw new Error(`Expected external plugin catalog entry for ${id}`);
  }
  return entry;
}

describe("official external plugin catalog", () => {
  it("lists the externalized provider and capability plugins with install metadata", () => {
    const providers = [
      ["arcee", "@quiet-core/arcee-provider"],
      ["cerebras", "@quiet-core/cerebras-provider"],
      ["chutes", "@quiet-core/chutes-provider"],
      ["cloudflare-ai-gateway", "@quiet-core/cloudflare-ai-gateway-provider"],
      ["deepinfra", "@quiet-core/deepinfra-provider"],
      ["deepseek", "@quiet-core/deepseek-provider"],
      ["groq", "@quiet-core/groq-provider"],
      ["kilocode", "@quiet-core/kilocode-provider"],
      ["kimi", "@quiet-core/kimi-provider"],
      ["qianfan", "@quiet-core/qianfan-provider"],
      ["qwen", "@quiet-core/qwen-provider"],
    ] as const;
    const plugins = [
      ["exa", "@quiet-core/exa-plugin"],
      ["firecrawl", "@quiet-core/firecrawl-plugin"],
      ["gradium", "@quiet-core/gradium-speech"],
      ["inworld", "@quiet-core/inworld-speech"],
      ["parallel", "@quiet-core/parallel-plugin"],
      ["perplexity", "@quiet-core/perplexity-plugin"],
    ] as const;
    const newlyExternalized = [
      ["clickclack", "@quiet-core/clickclack"],
      ["fireworks", "@quiet-core/fireworks-provider"],
      ["irc", "@quiet-core/irc"],
      ["mattermost", "@quiet-core/mattermost"],
      ["moonshot", "@quiet-core/moonshot-provider"],
      ["searxng", "@quiet-core/searxng-plugin"],
      ["signal", "@quiet-core/signal"],
      ["sms", "@quiet-core/sms"],
      ["tavily", "@quiet-core/tavily-plugin"],
      ["tencent", "@quiet-core/tencent-provider"],
      ["venice", "@quiet-core/venice-provider"],
      ["vercel-ai-gateway", "@quiet-core/vercel-ai-gateway-provider"],
      ["zai", "@quiet-core/zai-provider"],
    ] as const;

    for (const [id, npmSpec] of [...providers, ...plugins]) {
      expect(resolveOfficialExternalPluginInstall(expectCatalogEntry(id))).toEqual({
        clawhubSpec: `clawhub:${npmSpec}`,
        npmSpec,
        defaultChoice: "npm",
        minHostVersion: ">=2026.6.8",
      });
    }
    for (const [id, npmSpec] of newlyExternalized) {
      expect(resolveOfficialExternalPluginInstall(expectCatalogEntry(id))).toMatchObject({
        clawhubSpec: `clawhub:${npmSpec}`,
        npmSpec,
        defaultChoice: "npm",
        minHostVersion: ">=2026.6.9",
      });
    }
  });

  it("advertises StepFun with its ClawHub package and plugin API floor", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("stepfun"))).toEqual({
      clawhubSpec: "clawhub:@quiet-core/stepfun-provider",
      npmSpec: "@quiet-core/stepfun-provider",
      defaultChoice: "npm",
      minHostVersion: ">=2026.6.9",
    });
  });

  it("resolves third-party channel lookup aliases to published plugin ids", () => {
    const wecomByChannel = expectCatalogEntry("wecom");
    const wecomByPlugin = expectCatalogEntry("wecom-quiet-core-bot-plugin");
    const yuanbaoByChannel = expectCatalogEntry("yuanbao");

    expect(resolveOfficialExternalPluginId(wecomByChannel)).toBe("wecom-quiet-core-bot-plugin");
    expect(resolveOfficialExternalPluginId(wecomByPlugin)).toBe("wecom-quiet-core-bot-plugin");
    expect(resolveOfficialExternalPluginInstall(wecomByChannel)?.npmSpec).toBe(
      "@wecom/wecom-quiet-core-bot-plugin@2026.5.7",
    );
    expect(resolveOfficialExternalPluginId(yuanbaoByChannel)).toBe("quiet-core-bot-plugin-yuanbao");
    expect(resolveOfficialExternalPluginInstall(yuanbaoByChannel)?.npmSpec).toBe(
      "quiet-core-bot-plugin-yuanbao@2.15.0",
    );
  });

  it("keeps official launch package specs on the production package names", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("acpx"))?.npmSpec).toBe(
      "@quiet-core/acpx",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("googlechat"))?.npmSpec).toBe(
      "@quiet-core/googlechat",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("line"))?.npmSpec).toBe(
      "@quiet-core/line",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("diffs-language-pack"))).toEqual(
      {
        npmSpec: "@quiet-core/diffs-language-pack",
        clawhubSpec: "clawhub:@quiet-core/diffs-language-pack",
        defaultChoice: "npm",
        minHostVersion: ">=2026.5.27",
      },
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("llama-cpp"))?.npmSpec).toBe(
      "@quiet-core/llama-cpp-provider",
    );
  });

  it("lists GMI Cloud as an official external provider", () => {
    const gmi = expectCatalogEntry("gmi");

    expect(resolveOfficialExternalPluginId(gmi)).toBe("gmi");
    expect(getOfficialExternalPluginCatalogEntry("gmi-cloud")).toBe(gmi);
    expect(resolveOfficialExternalPluginInstall(gmi)).toEqual({
      clawhubSpec: "clawhub:@quiet-core/gmi-provider",
      npmSpec: "@quiet-core/gmi-provider",
      defaultChoice: "npm",
      minHostVersion: ">=2026.6.8",
    });
  });

  it("lists Cohere as an official external provider", () => {
    const cohere = expectCatalogEntry("cohere");

    expect(resolveOfficialExternalPluginId(cohere)).toBe("cohere");
    expect(resolveOfficialExternalPluginInstall(cohere)).toEqual({
      clawhubSpec: "clawhub:@quiet-core/cohere-provider",
      npmSpec: "@quiet-core/cohere-provider",
      defaultChoice: "npm",
      minHostVersion: ">=2026.6.8",
    });
  });

  it("resolves external provider aliases beyond the primary provider id", () => {
    const qwen = expectCatalogEntry("qwen");

    expect(getOfficialExternalPluginCatalogEntry("modelstudio")).toBe(qwen);
    expect(getOfficialExternalPluginCatalogEntry("qwen-oauth")).toBe(qwen);
    expect(getOfficialExternalPluginCatalogEntry("qwen-portal")).toBe(qwen);
  });

  it("maps external speech and web-fetch contracts to plugin owners", () => {
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "speechProviders",
        providerIds: new Set(["gradium", "inworld"]),
      }),
    ).toEqual(["gradium", "inworld"]);
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "webFetchProviders",
        providerIds: new Set(["firecrawl"]),
      }),
    ).toEqual(["firecrawl"]);
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "mediaUnderstandingProviders",
        providerIds: new Set(["groq", "moonshot", "zai"]),
      }),
    ).toEqual(["groq", "moonshot", "zai"]);
  });

  it("maps env-only web-fetch credentials to external plugin owners", () => {
    expect(
      resolveOfficialExternalWebProviderContractPluginIdsForEnv({
        contract: "webFetchProviders",
        env: { FIRECRAWL_API_KEY: "firecrawl-key" },
      }),
    ).toEqual(["firecrawl"]);
    expect(
      resolveOfficialExternalWebProviderContractPluginIdsForEnv({
        contract: "webFetchProviders",
        env: { EXA_API_KEY: "exa-key" },
      }),
    ).toEqual([]);
  });

  it("maps configured provider ids and aliases even without an auth choice", () => {
    expect(
      resolveOfficialExternalProviderPluginIds({
        providerIds: new Set(["groq", "modelstudio"]),
      }),
    ).toEqual(["groq", "qwen"]);
  });

  it("maps env-only provider credentials to external installs", () => {
    expect(
      resolveOfficialExternalProviderPluginIdsForEnv({
        ARCEEAI_API_KEY: "arcee-key",
        CEREBRAS_API_KEY: "cerebras-key",
        CHUTES_OAUTH_TOKEN: "chutes-token",
        CLOUDFLARE_AI_GATEWAY_API_KEY: "cloudflare-key",
        DEEPINFRA_API_KEY: "deepinfra-key",
        DEEPSEEK_API_KEY: "deepseek-key",
        GROQ_API_KEY: "groq-key",
        KILOCODE_API_KEY: "kilocode-key",
        KIMICODE_API_KEY: "kimi-key",
        KIMI_API_KEY: "moonshot-kimi-key",
        MOONSHOT_API_KEY: "moonshot-key",
        QIANFAN_API_KEY: "qianfan-key",
        MODELSTUDIO_API_KEY: "qwen-key",
        STEPFUN_API_KEY: "stepfun-key",
        FIREWORKS_API_KEY: "fireworks-key",
        TOKENHUB_API_KEY: "tokenhub-key",
        VENICE_API_KEY: "venice-key",
        AI_GATEWAY_API_KEY: "gateway-key",
        ZAI_API_KEY: "zai-key",
      }),
    ).toEqual([
      "arcee",
      "cerebras",
      "chutes",
      "cloudflare-ai-gateway",
      "deepinfra",
      "deepseek",
      "fireworks",
      "groq",
      "kilocode",
      "kimi",
      "moonshot",
      "qianfan",
      "qwen",
      "stepfun",
      "tencent",
      "venice",
      "vercel-ai-gateway",
      "zai",
    ]);
    expect(resolveOfficialExternalProviderPluginIdsForEnv({ GROQ_API_KEY: " " })).toEqual([]);
  });

  it("keeps Groq available through the cold-install auth catalog", () => {
    const groq = expectCatalogEntry("groq");
    const authChoice = groq.openclaw?.providers?.find((provider) => provider.id === "groq")
      ?.authChoices?.[0];

    expect(authChoice).toMatchObject({
      choiceId: "groq-api-key",
      optionKey: "groqApiKey",
      cliFlag: "--groq-api-key",
      cliOption: "--groq-api-key <key>",
    });
  });

  it("allows invalid-config recovery for externalized stock plugins", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("brave"))).toMatchObject({
      npmSpec: "@quiet-core/brave-plugin",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("slack"))).toMatchObject({
      npmSpec: "@quiet-core/slack",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("discord"))).toMatchObject({
      npmSpec: "@quiet-core/discord",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("mattermost"))).toMatchObject({
      npmSpec: "@quiet-core/mattermost",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("tavily"))).toMatchObject({
      npmSpec: "@quiet-core/tavily-plugin",
      allowInvalidConfigRecovery: true,
    });
  });

  it("lists Matrix as an official external ClawHub channel after cutover", () => {
    const ids = new Set<string>();
    for (const entry of listOfficialExternalPluginCatalogEntries()) {
      const pluginId = resolveOfficialExternalPluginId(entry);
      if (pluginId) {
        ids.add(pluginId);
      }
    }

    expect(ids.has("matrix")).toBe(true);
    expect(ids.has("mattermost")).toBe(true);
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("matrix"))).toEqual({
      clawhubSpec: "clawhub:@quiet-core/matrix",
      npmSpec: "@quiet-core/matrix",
      defaultChoice: "clawhub",
      minHostVersion: ">=2026.4.10",
      allowInvalidConfigRecovery: true,
    });
  });
});
