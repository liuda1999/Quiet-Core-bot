// Control UI declarative settings cards for the AI & Agents config sections.
import type { TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import type { SettingsCard, SettingsField, SettingsFieldKind } from "./settings-panel.ts";

function field(path: string, kind: SettingsFieldKind, options?: readonly string[]): SettingsField {
  return { path: path.split("."), kind, options };
}

function titleFor(section: string, cardId: string): string {
  return t(`settingsLabels.panels.${section}.${cardId}.title`);
}

function makeCard(
  section: string,
  id: string,
  icon: TemplateResult,
  fields: SettingsField[],
): SettingsCard {
  return { id, title: titleFor(section, id), icon, fields };
}

function agentCards(): SettingsCard[] {
  return [
    makeCard("agents", "models", icons.brain, [
      field("agents.defaults.model", "model"),
      field("agents.defaults.imageModel", "model"),
      field("agents.defaults.thinkingDefault", "select", [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "adaptive",
        "max",
      ]),
      field("agents.defaults.verboseDefault", "select", ["off", "on", "full"]),
      field("agents.defaults.reasoningDefault", "select", ["off", "on", "stream"]),
      field("agents.defaults.toolProgressDetail", "select", ["explain", "raw"]),
    ]),
    makeCard("agents", "workspace", icons.folder, [
      field("agents.defaults.workspace", "text"),
      field("agents.defaults.repoRoot", "text"),
      field("agents.defaults.skills", "tags"),
      field("agents.defaults.contextInjection", "select", ["always", "continuation-skip", "never"]),
    ]),
    makeCard("agents", "context", icons.activity, [
      field("agents.defaults.contextTokens", "number"),
      field("agents.defaults.compaction.mode", "select", ["default", "safeguard"]),
      field("agents.defaults.contextPruning.mode", "select", ["off", "cache-ttl"]),
      field("agents.defaults.timeoutSeconds", "number"),
      field("agents.defaults.mediaMaxMb", "number"),
    ]),
    makeCard("agents", "heartbeat", icons.clock, [
      field("agents.defaults.heartbeat.every", "text"),
      field("agents.defaults.heartbeat.model", "model"),
      field("agents.defaults.heartbeat.lightContext", "boolean"),
      field("agents.defaults.heartbeat.isolatedSession", "boolean"),
      field("agents.defaults.heartbeat.skipWhenBusy", "boolean"),
    ]),
    makeCard("agents", "subagents", icons.puzzle, [
      field("agents.defaults.subagents.delegationMode", "select", ["suggest", "prefer"]),
      field("agents.defaults.subagents.maxConcurrent", "number"),
      field("agents.defaults.subagents.maxSpawnDepth", "number"),
      field("agents.defaults.subagents.archiveAfterMinutes", "number"),
    ]),
    makeCard("agents", "sandbox", icons.archive, [
      field("agents.defaults.sandbox.mode", "select", ["off", "non-main", "all"]),
      field("agents.defaults.sandbox.backend", "text"),
      field("agents.defaults.sandbox.workspaceAccess", "select", ["none", "ro", "rw"]),
    ]),
  ];
}

function skillCards(): SettingsCard[] {
  return [
    makeCard("skills", "load", icons.puzzle, [
      field("skills.load.watch", "boolean"),
      field("skills.load.watchDebounceMs", "number"),
      field("skills.load.extraDirs", "tags"),
      field("skills.load.allowSymlinkTargets", "tags"),
    ]),
    makeCard("skills", "install", icons.download, [
      field("skills.install.preferBrew", "boolean"),
      field("skills.install.nodeManager", "select", ["npm", "pnpm", "yarn", "bun"]),
      field("skills.install.allowUploadedArchives", "boolean"),
    ]),
    makeCard("skills", "limits", icons.barChart, [
      field("skills.limits.maxSkillsInPrompt", "number"),
      field("skills.limits.maxSkillsPromptChars", "number"),
      field("skills.limits.maxSkillFileBytes", "number"),
      field("skills.limits.maxCandidatesPerRoot", "number"),
      field("skills.limits.maxSkillsLoadedPerSource", "number"),
    ]),
    makeCard("skills", "workshop", icons.wrench, [
      field("skills.workshop.autonomous.enabled", "boolean"),
      field("skills.workshop.approvalPolicy", "select", ["pending", "auto"]),
      field("skills.workshop.maxPending", "number"),
      field("skills.workshop.maxSkillBytes", "number"),
      field("skills.workshop.allowSymlinkTargetWrites", "boolean"),
    ]),
    makeCard("skills", "bundled", icons.book, [field("skills.allowBundled", "tags")]),
  ];
}

function toolCards(): SettingsCard[] {
  return [
    makeCard("tools", "policy", icons.wrench, [
      field("tools.profile", "select", ["minimal", "coding", "messaging", "full"]),
      field("tools.allow", "tags"),
      field("tools.deny", "tags"),
    ]),
    makeCard("tools", "exec", icons.terminal, [
      field("tools.exec.host", "select", ["auto", "sandbox", "gateway", "node"]),
      field("tools.exec.mode", "select", ["deny", "allowlist", "ask", "auto", "full"]),
      field("tools.exec.timeoutSec", "number"),
      field("tools.exec.backgroundMs", "number"),
      field("tools.exec.safeBins", "tags"),
      field("tools.exec.applyPatch.enabled", "boolean"),
    ]),
    makeCard("tools", "web", icons.globe, [
      field("tools.web.search.enabled", "boolean"),
      field("tools.web.search.provider", "text"),
      field("tools.web.search.maxResults", "number"),
      field("tools.web.search.apiKey", "secret"),
    ]),
    makeCard("tools", "fetch", icons.search, [
      field("tools.web.fetch.enabled", "boolean"),
      field("tools.web.fetch.provider", "text"),
      field("tools.web.fetch.maxChars", "number"),
      field("tools.web.fetch.timeoutSeconds", "number"),
      field("tools.web.fetch.firecrawl.enabled", "boolean"),
      field("tools.web.fetch.firecrawl.apiKey", "secret"),
    ]),
    makeCard("tools", "fsMedia", icons.image, [
      field("tools.fs.workspaceOnly", "boolean"),
      field("tools.media.concurrency", "number"),
      field("tools.media.image.enabled", "boolean"),
      field("tools.media.audio.enabled", "boolean"),
      field("tools.media.video.enabled", "boolean"),
    ]),
    makeCard("tools", "loop", icons.activity, [
      field("tools.loopDetection.enabled", "boolean"),
      field("tools.loopDetection.warningThreshold", "number"),
      field("tools.loopDetection.criticalThreshold", "number"),
      field("tools.loopDetection.globalCircuitBreakerThreshold", "number"),
    ]),
    makeCard("tools", "sessions", icons.link, [
      field("tools.sessions.visibility", "select", ["self", "tree", "agent", "all"]),
      field("tools.agentToAgent.enabled", "boolean"),
      field("tools.elevated.enabled", "boolean"),
    ]),
  ];
}

function memoryCards(): SettingsCard[] {
  return [
    makeCard("memory", "backend", icons.book, [
      field("memory.backend", "select", ["builtin", "qmd"]),
      field("memory.citations", "select", ["auto", "on", "off"]),
    ]),
    makeCard("memory", "search", icons.search, [
      field("agents.defaults.memorySearch.enabled", "boolean"),
      field("agents.defaults.memorySearch.provider", "text"),
      field("agents.defaults.memorySearch.model", "text"),
      field("agents.defaults.memorySearch.query.maxResults", "number"),
      field("agents.defaults.memorySearch.query.minScore", "number"),
      field("agents.defaults.memorySearch.store.vector.enabled", "boolean"),
    ]),
    makeCard("memory", "qmd", icons.plug, [
      field("memory.qmd.command", "text"),
      field("memory.qmd.searchMode", "select", ["query", "search", "vsearch"]),
      field("memory.qmd.rerank", "boolean"),
      field("memory.qmd.includeDefaultMemory", "boolean"),
      field("memory.qmd.limits.maxResults", "number"),
    ]),
    makeCard("memory", "qmdUpdate", icons.refresh, [
      field("memory.qmd.update.interval", "text"),
      field("memory.qmd.update.onBoot", "boolean"),
      field("memory.qmd.update.startup", "select", ["off", "idle", "immediate"]),
    ]),
    makeCard("memory", "qmdSessions", icons.archive, [
      field("memory.qmd.sessions.enabled", "boolean"),
      field("memory.qmd.sessions.exportDir", "text"),
      field("memory.qmd.sessions.retentionDays", "number"),
    ]),
  ];
}

function sessionCards(): SettingsCard[] {
  return [
    makeCard("session", "scope", icons.link, [
      field("session.scope", "select", ["per-sender", "global"]),
      field("session.dmScope", "select", [
        "main",
        "per-peer",
        "per-channel-peer",
        "per-account-channel-peer",
      ]),
      field("session.mainKey", "text"),
      field("session.store", "text"),
    ]),
    makeCard("session", "reset", icons.refresh, [
      field("session.reset.mode", "select", ["daily", "idle"]),
      field("session.reset.atHour", "number"),
      field("session.reset.idleMinutes", "number"),
      field("session.idleMinutes", "number"),
      field("session.resetTriggers", "tags"),
    ]),
    makeCard("session", "send", icons.send, [
      field("session.sendPolicy.default", "select", ["allow", "deny"]),
    ]),
    makeCard("session", "writeLock", icons.settings, [
      field("session.writeLock.acquireTimeoutMs", "number"),
      field("session.writeLock.staleMs", "number"),
      field("session.writeLock.maxHoldMs", "number"),
    ]),
    makeCard("session", "threads", icons.puzzle, [
      field("session.threadBindings.enabled", "boolean"),
      field("session.threadBindings.idleHours", "number"),
      field("session.threadBindings.maxAgeHours", "number"),
      field("session.threadBindings.spawnSessions", "boolean"),
    ]),
    makeCard("session", "maintenance", icons.archive, [
      field("session.maintenance.mode", "select", ["enforce", "warn"]),
      field("session.maintenance.maxEntries", "number"),
      field("session.maintenance.pruneAfter", "text"),
      field("session.maintenance.maxDiskBytes", "text"),
      field("session.maintenance.highWaterBytes", "text"),
    ]),
  ];
}

export function buildSettingsPanelCards(section: string): SettingsCard[] | null {
  switch (section) {
    case "agents":
      return agentCards();
    case "skills":
      return skillCards();
    case "tools":
      return toolCards();
    case "memory":
      return memoryCards();
    case "session":
      return sessionCards();
    default:
      return null;
  }
}
