/**
 * Declarative channel setup wizard contract.
 *
 * Defines status, credentials, prompts, group access, and finalization types for setup flows.
 */
import type { DmPolicy } from "../../config/types.js";
import type { QuietCoreConfig } from "../../config/types.quiet-core-bot.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { WizardPrompter } from "../../wizard/prompts.js";
import type { ChannelAccessPolicy } from "./setup-group-access.js";
import type { ChannelConfigAdapter, ChannelSetupAdapter } from "./types.adapters.js";
import type {
  ChannelCapabilities,
  ChannelId,
  ChannelMeta,
  ChannelSetupInput,
} from "./types.core.js";

export type ChannelSetupPlugin = {
  id: ChannelId;
  meta: ChannelMeta;
  capabilities: ChannelCapabilities;
  config: ChannelConfigAdapter<unknown>;
  setup?: ChannelSetupAdapter;
  setupWizard?: ChannelSetupWizard | ChannelSetupWizardAdapter;
};

/** Status block shown before users select channels during setup. */
export type ChannelSetupWizardStatus = {
  configuredLabel: string;
  unconfiguredLabel: string;
  configuredHint?: string;
  unconfiguredHint?: string;
  configuredScore?: number;
  unconfiguredScore?: number;
  resolveConfigured: (params: {
    cfg: QuietCoreConfig;
    accountId?: string;
  }) => boolean | Promise<boolean>;
  resolveStatusLines?: (params: {
    cfg: QuietCoreConfig;
    accountId?: string;
    configured: boolean;
  }) => string[] | Promise<string[]>;
  resolveSelectionHint?: (params: {
    cfg: QuietCoreConfig;
    accountId?: string;
    configured: boolean;
  }) => string | undefined | Promise<string | undefined>;
  resolveQuickstartScore?: (params: {
    cfg: QuietCoreConfig;
    accountId?: string;
    configured: boolean;
  }) => number | undefined | Promise<number | undefined>;
};

/** Snapshot of one credential before prompting or reusing existing config. */
export type ChannelSetupWizardCredentialState = {
  accountConfigured: boolean;
  hasConfiguredValue: boolean;
  resolvedValue?: string;
  envValue?: string;
};

export type ChannelSetupWizardCredentialValues = Partial<Record<string, string>>;

/** Optional explanatory note shown when its owning step is reached. */
export type ChannelSetupWizardNote = {
  title: string;
  lines: string[];
  shouldShow?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
  }) => boolean | Promise<boolean>;
};

/** Lets a wizard configure an account entirely from existing environment. */
export type ChannelSetupWizardEnvShortcut = {
  prompt: string;
  preferredEnvVar?: string;
  isAvailable: (params: { cfg: QuietCoreConfig; accountId: string }) => boolean;
  apply: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
  }) => QuietCoreConfig | Promise<QuietCoreConfig>;
};

/** Declarative secret/input step for a channel account credential. */
export type ChannelSetupWizardCredential = {
  inputKey: keyof ChannelSetupInput;
  providerHint: string;
  credentialLabel: string;
  preferredEnvVar?: string;
  helpTitle?: string;
  helpLines?: string[];
  envPrompt: string;
  keepPrompt: string;
  inputPrompt: string;
  allowEnv?: (params: { cfg: QuietCoreConfig; accountId: string }) => boolean;
  inspect: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
  }) => ChannelSetupWizardCredentialState;
  shouldPrompt?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
    currentValue?: string;
    state: ChannelSetupWizardCredentialState;
  }) => boolean | Promise<boolean>;
  applyUseEnv?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
  }) => QuietCoreConfig | Promise<QuietCoreConfig>;
  applySet?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
    value: unknown;
    resolvedValue: string;
  }) => QuietCoreConfig | Promise<QuietCoreConfig>;
};

/** Declarative non-secret text step that can depend on resolved credentials. */
export type ChannelSetupWizardTextInput = {
  inputKey: keyof ChannelSetupInput;
  message: string;
  placeholder?: string;
  required?: boolean;
  applyEmptyValue?: boolean;
  helpTitle?: string;
  helpLines?: string[];
  confirmCurrentValue?: boolean;
  keepPrompt?: string | ((value: string) => string);
  currentValue?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
  }) => string | undefined | Promise<string | undefined>;
  initialValue?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
  }) => string | undefined | Promise<string | undefined>;
  shouldPrompt?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
    currentValue?: string;
  }) => boolean | Promise<boolean>;
  applyCurrentValue?: boolean;
  validate?: (params: {
    value: string;
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
  }) => string | undefined;
  normalizeValue?: (params: {
    value: string;
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
  }) => string;
  applySet?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    value: string;
  }) => QuietCoreConfig | Promise<QuietCoreConfig>;
};

export type ChannelSetupWizardAllowFromEntry = {
  input: string;
  resolved: boolean;
  id: string | null;
};

/** Channel-specific resolver for user-entered allowlist targets. */
export type ChannelSetupWizardAllowFrom = {
  helpTitle?: string;
  helpLines?: string[];
  credentialInputKey?: keyof ChannelSetupInput;
  message: string;
  placeholder: string;
  invalidWithoutCredentialNote: string;
  parseInputs?: (raw: string) => string[];
  parseId: (raw: string) => string | null;
  resolveEntries: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
    entries: string[];
  }) => Promise<ChannelSetupWizardAllowFromEntry[]>;
  apply: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    allowFrom: string[];
  }) => QuietCoreConfig | Promise<QuietCoreConfig>;
};

/** Declarative group/DM access policy step used by interactive setup. */
export type ChannelSetupWizardGroupAccess = {
  label: string;
  placeholder: string;
  helpTitle?: string;
  helpLines?: string[];
  skipAllowlistEntries?: boolean;
  currentPolicy: (params: { cfg: QuietCoreConfig; accountId: string }) => ChannelAccessPolicy;
  currentEntries: (params: { cfg: QuietCoreConfig; accountId: string }) => string[];
  updatePrompt: (params: { cfg: QuietCoreConfig; accountId: string }) => boolean;
  setPolicy: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    policy: ChannelAccessPolicy;
  }) => QuietCoreConfig;
  resolveAllowlist?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    credentialValues: ChannelSetupWizardCredentialValues;
    entries: string[];
    prompter: Pick<WizardPrompter, "note">;
  }) => Promise<unknown>;
  applyAllowlist?: (params: {
    cfg: QuietCoreConfig;
    accountId: string;
    resolved: unknown;
  }) => QuietCoreConfig;
};

/** Optional pre-step hook for deriving helper config or credential values. */
export type ChannelSetupWizardPrepare = (params: {
  cfg: QuietCoreConfig;
  accountId: string;
  credentialValues: ChannelSetupWizardCredentialValues;
  runtime: ChannelSetupConfigureContext["runtime"];
  prompter: WizardPrompter;
  options?: ChannelSetupConfigureContext["options"];
}) =>
  | {
      cfg?: QuietCoreConfig;
      credentialValues?: ChannelSetupWizardCredentialValues;
    }
  | void
  | Promise<{
      cfg?: QuietCoreConfig;
      credentialValues?: ChannelSetupWizardCredentialValues;
    } | void>;

/** Optional post-step hook for final validation, writes, or post prompts. */
export type ChannelSetupWizardFinalize = (params: {
  cfg: QuietCoreConfig;
  accountId: string;
  credentialValues: ChannelSetupWizardCredentialValues;
  runtime: ChannelSetupConfigureContext["runtime"];
  prompter: WizardPrompter;
  options?: ChannelSetupConfigureContext["options"];
  forceAllowFrom: boolean;
}) =>
  | {
      cfg?: QuietCoreConfig;
      credentialValues?: ChannelSetupWizardCredentialValues;
    }
  | void
  | Promise<{
      cfg?: QuietCoreConfig;
      credentialValues?: ChannelSetupWizardCredentialValues;
    } | void>;

/** Full declarative setup wizard consumed by the generic setup adapter. */
export type ChannelSetupWizard = {
  channel: string;
  status: ChannelSetupWizardStatus;
  introNote?: ChannelSetupWizardNote;
  envShortcut?: ChannelSetupWizardEnvShortcut;
  resolveAccountIdForConfigure?: (params: {
    cfg: QuietCoreConfig;
    prompter: WizardPrompter;
    options?: ChannelSetupConfigureContext["options"];
    accountOverride?: string;
    shouldPromptAccountIds: boolean;
    listAccountIds: ChannelSetupPlugin["config"]["listAccountIds"];
    defaultAccountId: string;
  }) => string | Promise<string>;
  resolveShouldPromptAccountIds?: (params: {
    cfg: QuietCoreConfig;
    options?: ChannelSetupConfigureContext["options"];
    shouldPromptAccountIds: boolean;
  }) => boolean;
  prepare?: ChannelSetupWizardPrepare;
  stepOrder?: "credentials-first" | "text-first";
  credentials: ChannelSetupWizardCredential[];
  textInputs?: ChannelSetupWizardTextInput[];
  finalize?: ChannelSetupWizardFinalize;
  completionNote?: ChannelSetupWizardNote;
  dmPolicy?: ChannelSetupDmPolicy;
  allowFrom?: ChannelSetupWizardAllowFrom;
  groupAccess?: ChannelSetupWizardGroupAccess;
  disable?: (cfg: QuietCoreConfig) => QuietCoreConfig;
  onAccountRecorded?: ChannelSetupWizardAdapter["onAccountRecorded"];
};

/** Runtime options for selecting and configuring one or more channels. */
export type SetupChannelsOptions = {
  allowDisable?: boolean;
  allowSignalInstall?: boolean;
  onSelection?: (selection: ChannelId[]) => void;
  onPostWriteHook?: (hook: ChannelOnboardingPostWriteHook) => void;
  accountIds?: Partial<Record<ChannelId, string>>;
  onAccountId?: (channel: ChannelId, accountId: string) => void;
  onResolvedPlugin?: (channel: ChannelId, plugin: ChannelSetupPlugin) => void;
  promptAccountIds?: boolean;
  forceAllowFromChannels?: ChannelId[];
  deferStatusUntilSelection?: boolean;
  skipStatusNote?: boolean;
  skipDmPolicyPrompt?: boolean;
  skipConfirm?: boolean;
  quickstartDefaults?: boolean;
  initialSelection?: ChannelId[];
  secretInputMode?: "plaintext" | "ref";
};

export type PromptAccountIdParams = {
  cfg: QuietCoreConfig;
  prompter: WizardPrompter;
  label: string;
  currentId?: string;
  listAccountIds: (cfg: QuietCoreConfig) => string[];
  defaultAccountId: string;
};

export type PromptAccountId = (params: PromptAccountIdParams) => Promise<string>;

export type ChannelSetupStatus = {
  channel: ChannelId;
  configured: boolean;
  statusLines: string[];
  selectionHint?: string;
  quickstartScore?: number;
};

/** Shared context for status checks before channel selection. */
export type ChannelSetupStatusContext = {
  cfg: QuietCoreConfig;
  options?: SetupChannelsOptions;
  accountOverrides: Partial<Record<ChannelId, string>>;
};

/** Shared context for applying setup changes for a selected channel. */
export type ChannelSetupConfigureContext = {
  cfg: QuietCoreConfig;
  runtime: RuntimeEnv;
  prompter: WizardPrompter;
  options?: SetupChannelsOptions;
  accountOverrides: Partial<Record<ChannelId, string>>;
  shouldPromptAccountIds: boolean;
  forceAllowFrom: boolean;
};

/** Context passed after setup has written config to disk. */
export type ChannelOnboardingPostWriteContext = {
  previousCfg: QuietCoreConfig;
  cfg: QuietCoreConfig;
  accountId: string;
  runtime: RuntimeEnv;
};

/** Deferred hook for channel work that must run after config persistence. */
export type ChannelOnboardingPostWriteHook = {
  channel: ChannelId;
  accountId: string;
  run: (ctx: { cfg: QuietCoreConfig; runtime: RuntimeEnv }) => Promise<void> | void;
};

export type ChannelSetupResult = {
  cfg: QuietCoreConfig;
  accountId?: string;
};

export type ChannelSetupConfiguredResult = ChannelSetupResult | "skip";

export type ChannelSetupInteractiveContext = ChannelSetupConfigureContext & {
  configured: boolean;
  label: string;
};

/** Optional direct-message policy contract exposed by setup adapters. */
export type ChannelSetupDmPolicy = {
  label: string;
  channel: ChannelId;
  policyKey: string;
  allowFromKey: string;
  resolveConfigKeys?: (
    cfg: QuietCoreConfig,
    accountId?: string,
  ) => { policyKey: string; allowFromKey: string };
  getCurrent: (cfg: QuietCoreConfig, accountId?: string) => DmPolicy;
  setPolicy: (cfg: QuietCoreConfig, policy: DmPolicy, accountId?: string) => QuietCoreConfig;
  promptAllowFrom?: (params: {
    cfg: QuietCoreConfig;
    prompter: WizardPrompter;
    accountId?: string;
  }) => Promise<QuietCoreConfig>;
};

/** Imperative adapter consumed by onboarding and setup flows. */
export type ChannelSetupWizardAdapter = {
  channel: ChannelId;
  getStatus: (ctx: ChannelSetupStatusContext) => Promise<ChannelSetupStatus>;
  configure: (ctx: ChannelSetupConfigureContext) => Promise<ChannelSetupResult>;
  configureInteractive?: (
    ctx: ChannelSetupInteractiveContext,
  ) => Promise<ChannelSetupConfiguredResult>;
  configureWhenConfigured?: (
    ctx: ChannelSetupInteractiveContext,
  ) => Promise<ChannelSetupConfiguredResult>;
  afterConfigWritten?: (ctx: ChannelOnboardingPostWriteContext) => Promise<void> | void;
  dmPolicy?: ChannelSetupDmPolicy;
  onAccountRecorded?: (accountId: string, options?: SetupChannelsOptions) => void;
  disable?: (cfg: QuietCoreConfig) => QuietCoreConfig;
};
