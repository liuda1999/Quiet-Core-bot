// Core root-command descriptor catalog used for help placeholders and lazy registration.
import { defineCommandDescriptorCatalog } from "./command-descriptor-utils.js";
import type { NamedCommandDescriptor } from "./command-group-descriptors.js";

/** Descriptor shape for root commands owned by the core CLI. */
export type CoreCliCommandDescriptor = NamedCommandDescriptor;

const coreCliCommandCatalog = defineCommandDescriptorCatalog<CoreCliCommandDescriptor>([
  {
    name: "crestodian",
    description: "Open the interactive setup and repair assistant",
    hasSubcommands: false,
  },
  {
    name: "setup",
    description: "Initialize local config and an agent workspace",
    hasSubcommands: false,
    stateMigration: true,
  },
  {
    name: "onboard",
    description: "Interactive onboarding for gateway, workspace, and skills",
    hasSubcommands: false,
    stateMigration: true,
  },
  {
    name: "configure",
    description: "Interactive configuration for credentials, channels, gateway, and agent defaults",
    hasSubcommands: false,
    stateMigration: true,
  },
  {
    name: "config",
    description:
      "Non-interactive config helpers (get/set/unset/file/validate). Default: starts guided setup.",
    hasSubcommands: true,
  },
  {
    name: "backup",
    description: "Create and verify local backup archives for Quiet Core bot state",
    hasSubcommands: true,
  },
  {
    name: "migrate",
    description: "Import state from another agent system",
    hasSubcommands: true,
    stateMigration: true,
  },
  {
    name: "doctor",
    description: "Diagnose and repair config, Gateway, plugin, and channel problems",
    hasSubcommands: false,
    stateMigration: true,
  },
  {
    name: "dashboard",
    description: "Open the Control UI with your current token",
    hasSubcommands: false,
  },
  {
    name: "reset",
    description: "Reset local config/state (keeps the CLI installed)",
    hasSubcommands: false,
    stateMigration: true,
  },
  {
    name: "uninstall",
    description: "Uninstall the gateway service + local data (CLI remains)",
    hasSubcommands: false,
  },
  {
    name: "message",
    description: "Send, read, and manage channel messages",
    hasSubcommands: true,
    stateMigration: true,
  },
  {
    name: "mcp",
    description: "Manage Quiet Core bot MCP config and channel bridge",
    hasSubcommands: true,
    parentDefaultHelp: true,
  },
  {
    name: "transcripts",
    description: "Inspect stored transcripts",
    hasSubcommands: true,
  },
  {
    name: "agent",
    description: "Run one agent turn via the Gateway",
    hasSubcommands: false,
    stateMigration: true,
  },
  {
    name: "agents",
    description: "Manage isolated agents (workspaces, auth, routing)",
    hasSubcommands: true,
  },
  {
    name: "status",
    description: "Show Gateway, channel, model, and recent-session status",
    hasSubcommands: false,
  },
  {
    name: "health",
    description: "Fetch detailed health from the running Gateway",
    hasSubcommands: false,
  },
  {
    name: "sessions",
    description: "List stored conversation sessions",
    hasSubcommands: true,
  },
  {
    name: "commitments",
    description: "List and manage inferred follow-up commitments",
    hasSubcommands: true,
  },
  {
    name: "tasks",
    description: "Inspect durable background tasks and flows",
    hasSubcommands: true,
    stateMigration: true,
  },
] as const satisfies ReadonlyArray<CoreCliCommandDescriptor>);

/** Static root-command descriptors for the core CLI surface. */
export const CORE_CLI_COMMAND_DESCRIPTORS = coreCliCommandCatalog.descriptors;

/** Return core root-command descriptors in help/registration order. */
export function getCoreCliCommandDescriptors(): ReadonlyArray<CoreCliCommandDescriptor> {
  return coreCliCommandCatalog.getDescriptors();
}

/** Return names for all core root commands. */
export function getCoreCliCommandNames(): string[] {
  return coreCliCommandCatalog.getNames();
}

/** Return core root commands that own child subcommands. */
export function getCoreCliCommandsWithSubcommands(): string[] {
  return coreCliCommandCatalog.getCommandsWithSubcommands();
}

/** Return core root commands whose parent action should default to help. */
export function getCoreCliParentDefaultHelpCommands(): string[] {
  return coreCliCommandCatalog.getParentDefaultHelpCommands();
}
