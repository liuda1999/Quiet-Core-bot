---
title: "Agent runtime architecture"
summary: "How Quiet Core bot runs the built-in agent runtime, providers, sessions, tools, and extensions."
---

Quiet Core bot owns the built-in agent runtime directly. The runtime code lives under `src/agents/`, model/provider helpers live under `src/llm/`, and plugin-facing contracts are exposed through `quiet-core-bot/plugin-sdk/*` barrels.

## Runtime Layout

- `src/agents/embedded-agent-runner/`: built-in agent attempt loop, provider stream adapters, compaction, model selection, and session wiring.
- `src/agents/sessions/`: session persistence, extension loading, resource discovery, skills, prompts, themes, and TUI-backed tool renderers.
- `packages/agent-core/`: reusable agent core, lower-level harness types, messages, compaction helpers, prompt templates, and tool/session contracts.
- `src/agents/runtime/`: Quiet Core bot facade for `@quiet-core/agent-core` plus local proxy utilities.
- `src/agents/agent-tools*.ts`: Quiet Core bot-owned tool definitions, schemas, policy, before/after hook adapters, and host edit support.
- `src/agents/agent-hooks/`: built-in runtime hooks such as compaction safeguards and context pruning.
- `src/llm/`: model/provider registry, transport helpers, and provider-specific stream implementations.

## Boundaries

Core code calls the built-in runtime through Quiet Core bot modules and SDK barrels, not through old external agent packages. Plugins use documented `quiet-core-bot/plugin-sdk/*` entrypoints and do not import `src/**` internals.

`@earendil-works/pi-tui` remains a third-party TUI dependency. It is used as a terminal component toolkit by the local TUI and session renderers; internalizing it would be a separate vendoring effort.

## Manifests

Resource packages declare Quiet Core bot resources in package metadata:

```json
{
  "quiet-core-bot": {
    "extensions": ["extensions/index.ts"],
    "skills": ["skills/*.md"],
    "prompts": ["prompts/*.md"],
    "themes": ["themes/*.json"]
  }
}
```

The package manager also discovers conventional `extensions/`, `skills/`, `prompts/`, and `themes/` directories.

## Runtime Selection

The default built-in runtime id is `quiet-core-bot`. Plugin harnesses can register additional runtime ids. `auto` selects a supporting plugin harness when one exists and otherwise uses the built-in Quiet Core bot runtime.

## Related

- [Quiet Core bot agent runtime workflow](/quiet-core-bot-agent-runtime)
- [Agent runtimes](/concepts/agent-runtimes)
