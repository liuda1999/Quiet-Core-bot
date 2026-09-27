// Channel catalog contract tests cover bundled and registry-backed channel catalog invariants.
import {
  describeBundledMetadataOnlyChannelCatalogContract,
  describeChannelCatalogEntryContract,
  describeOfficialFallbackChannelCatalogContract,
} from "./test-helpers/channel-catalog-contract.js";

describeChannelCatalogEntryContract({
  channelId: "msteams",
  npmSpec: "@quiet-core/msteams",
  alias: "teams",
});

const whatsappMeta = {
  id: "whatsapp",
  label: "WhatsApp",
  selectionLabel: "WhatsApp (QR link)",
  detailLabel: "WhatsApp Web",
  docsPath: "/channels/whatsapp",
  blurb: "works with your own number; recommend a separate phone + eSIM.",
};

describeBundledMetadataOnlyChannelCatalogContract({
  pluginId: "whatsapp",
  packageName: "@quiet-core/whatsapp",
  npmSpec: "@quiet-core/whatsapp",
  meta: whatsappMeta,
  defaultChoice: "npm",
});

describeOfficialFallbackChannelCatalogContract({
  channelId: "whatsapp",
  npmSpec: "@quiet-core/whatsapp",
  meta: whatsappMeta,
  packageName: "@quiet-core/whatsapp",
  pluginId: "whatsapp",
  externalNpmSpec: "@vendor/whatsapp-fork",
  externalLabel: "WhatsApp Fork",
});

describeChannelCatalogEntryContract({
  channelId: "wecom",
  npmSpec: "@wecom/wecom-quiet-core-bot-plugin@2026.5.7",
  alias: "wework",
});

describeChannelCatalogEntryContract({
  channelId: "yuanbao",
  npmSpec: "quiet-core-bot-plugin-yuanbao@2.15.0",
  alias: "yb",
});

describeChannelCatalogEntryContract({
  channelId: "quiet-core-bot-zaloclawbot",
  npmSpec: "@zalo-platforms/quiet-core-bot-zaloclawbot@0.1.4",
  alias: "zaloclawbot",
});
