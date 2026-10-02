// Small channel config mutators used by guided and non-interactive channel add flows.
import { getChannelPlugin } from "../../channels/plugins/index.js";
import type { ChannelPlugin } from "../../channels/plugins/types.plugin.js";
import type { ChannelId, ChannelSetupInput } from "../../channels/plugins/types.public.js";
import { GENERATED_BUNDLED_CHANNEL_CONFIG_METADATA } from "../../config/bundled-channel-config-metadata.generated.js";
import type { QuietCoreConfig } from "../../config/types.quiet-core-bot.js";
import { normalizeAccountId } from "../../routing/session-key.js";

type ChatChannel = ChannelId;
type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Apply a display name to a channel account when the plugin supports account naming. */
export function applyAccountName(params: {
  cfg: QuietCoreConfig;
  channel: ChatChannel;
  accountId: string;
  name?: string;
  plugin?: ChannelPlugin;
}): QuietCoreConfig {
  const accountId = normalizeAccountId(params.accountId);
  const plugin = params.plugin ?? getChannelPlugin(params.channel);
  const apply = plugin?.setup?.applyAccountName;
  return apply ? apply({ cfg: params.cfg, accountId, name: params.name }) : params.cfg;
}

/** Delegate account config mutation to the channel plugin setup contract. */
export function applyChannelAccountConfig(params: {
  cfg: QuietCoreConfig;
  channel: ChatChannel;
  accountId: string;
  input: ChannelSetupInput;
  plugin?: ChannelPlugin;
}): QuietCoreConfig {
  const accountId = normalizeAccountId(params.accountId);
  const plugin = params.plugin ?? getChannelPlugin(params.channel);
  const apply = plugin?.setup?.applyAccountConfig;
  if (!apply) {
    return params.cfg;
  }
  return apply({ cfg: params.cfg, accountId, input: params.input });
}

function resolveBundledChannelSchema(channel: ChatChannel): JsonRecord | undefined {
  const normalized = channel.trim().toLowerCase();
  const entry = GENERATED_BUNDLED_CHANNEL_CONFIG_METADATA.find((candidate) => {
    if (candidate.configurable === false) {
      return false;
    }
    if (candidate.channelId.toLowerCase() === normalized) {
      return true;
    }
    return (candidate.aliases ?? []).some((alias) => alias.toLowerCase() === normalized);
  });
  return isJsonRecord(entry?.schema) ? entry.schema : undefined;
}

function fillRequiredDefaults(schema: JsonRecord, value: JsonRecord): JsonRecord {
  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = isJsonRecord(schema.properties) ? schema.properties : {};
  let next = value;
  for (const key of required) {
    if (typeof key !== "string" || Object.hasOwn(next, key)) {
      continue;
    }
    const property = properties[key];
    if (isJsonRecord(property) && property.default !== undefined) {
      next = next === value ? { ...value } : next;
      next[key] = property.default;
    }
  }
  return next;
}

function fillAccountRequiredDefaults(schema: JsonRecord, section: JsonRecord): JsonRecord {
  const properties = isJsonRecord(schema.properties) ? schema.properties : {};
  const accountsSchema = isJsonRecord(properties.accounts) ? properties.accounts : undefined;
  const accountSchema = isJsonRecord(accountsSchema?.additionalProperties)
    ? accountsSchema.additionalProperties
    : undefined;
  if (!accountSchema || !isJsonRecord(section.accounts)) {
    return section;
  }
  const accounts: JsonRecord = { ...section.accounts };
  let changed = false;
  for (const [accountId, account] of Object.entries(section.accounts)) {
    if (!isJsonRecord(account)) {
      continue;
    }
    const nextAccount = fillRequiredDefaults(accountSchema, account);
    if (nextAccount !== account) {
      accounts[accountId] = nextAccount;
      changed = true;
    }
  }
  return changed ? { ...section, accounts } : section;
}

/**
 * Fills bundled channel schema required defaults (for example dmPolicy/groupPolicy) into a
 * freshly written channel section so the persisted config matches the declared schema.
 */
export function applyBundledChannelRequiredDefaults(params: {
  cfg: QuietCoreConfig;
  channel: ChatChannel;
}): QuietCoreConfig {
  const schema = resolveBundledChannelSchema(params.channel);
  if (!schema) {
    return params.cfg;
  }
  const channels = params.cfg.channels as Record<string, unknown> | undefined;
  const section = channels?.[params.channel];
  if (!isJsonRecord(section)) {
    return params.cfg;
  }
  const withRootDefaults = fillRequiredDefaults(schema, section);
  const withAccountDefaults = fillAccountRequiredDefaults(schema, withRootDefaults);
  if (withAccountDefaults === section) {
    return params.cfg;
  }
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      [params.channel]: withAccountDefaults,
    },
  } as QuietCoreConfig;
}
